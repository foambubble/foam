/* @unit-ready */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Selection, window, workspace } from 'vscode';
import { Resolver, Template, TriggerFactory, URI } from '@foam/core';
import { NoteFactory } from './note-factory';
import {
  closeEditors,
  createFile,
  deleteFile,
  getUriInWorkspace,
  makeFoamMock,
  showInEditor,
} from '../../test/test-utils-vscode';
import { fileExists } from './editor';

const text = (content: string) => async (): Promise<Template> => ({
  type: 'markdown',
  content,
  metadata: new Map(),
});

const options = (content: string, target: URI) => ({
  trigger: TriggerFactory.createCommandTrigger('test'),
  resolver: new Resolver(new Map(), new Date()),
  loadTemplate: text(content),
  fallbackFilepath: target,
});

describe('NoteFactory.createNote', () => {
  beforeEach(async () => {
    await closeEditors();
  });

  it('should create a new note', async () => {
    const target = getUriInWorkspace();
    const result = await NoteFactory.createNote(
      makeFoamMock(),
      options('Hello World', target)
    );
    expect(result).toEqual({ didCreateFile: true, uri: target });
    expect(await fileExists(target)).toBeTruthy();
    expect(window.activeTextEditor.document.getText()).toEqual('Hello World');
    await deleteFile(target);
  });

  it('should support not replacing the selection with a link to the newly created note', async () => {
    const file = await createFile('This is my first file: World');
    const { editor } = await showInEditor(file.uri);
    editor.selection = new Selection(0, 23, 0, 28);
    const target = getUriInWorkspace();
    await NoteFactory.createNote(makeFoamMock(), {
      ...options('Hello World World', target),
      replaceSelectionWithLink: false,
    });
    expect(window.activeTextEditor.document.getText()).toEqual(
      'Hello World World'
    );
    expect(window.visibleTextEditors[0].document.getText()).toEqual(
      `This is my first file: World`
    );
    await deleteFile(file.uri);
    await deleteFile(target);
  });

  it('should support replacing the selection with a link to the newly created note', async () => {
    const file = await createFile('This is my first file: World');
    const { editor } = await showInEditor(file.uri);
    editor.selection = new Selection(0, 23, 0, 28);
    const target = getUriInWorkspace();
    await NoteFactory.createNote(makeFoamMock(), {
      ...options('Hello World World', target),
      replaceSelectionWithLink: true,
    });
    expect(window.activeTextEditor.document.getText()).toEqual(
      'Hello World World'
    );
    expect(window.visibleTextEditors[0].document.getText()).toEqual(
      `This is my first file: [[${target.getName()}]]`
    );
    await deleteFile(file.uri);
    await deleteFile(target);
  });

  it('reports an existing note without creating a file when the strategy stops', async () => {
    const existing = await createFile('already here');
    const result = await NoteFactory.createNote(makeFoamMock(), {
      ...options('new content', existing.uri),
      onFileExists: 'cancel',
    });
    expect(result).toEqual({ didCreateFile: false, uri: existing.uri });
    expect(window.activeTextEditor).toBeUndefined();
    await deleteFile(existing.uri);
  });

  it('reports a cancelled relative path without a uri', async () => {
    const result = await NoteFactory.createNote(makeFoamMock(), {
      ...options('new content', URI.parse('relative-note.md', 'file')),
      onRelativePath: 'cancel',
    });
    expect(result).toEqual({ didCreateFile: false, uri: undefined });
  });

  it('refuses a target outside the workspace unless the workspace is trusted', async () => {
    const outside = URI.file('/outside-the-workspace/note.md');
    const trusted = vi.spyOn(workspace, 'isTrusted', 'get');
    try {
      trusted.mockReturnValue(false);
      await expect(
        NoteFactory.createNote(makeFoamMock(), options('x', outside))
      ).rejects.toThrow(/Restricted Mode/);
      expect(await fileExists(outside)).toBe(false);
    } finally {
      trusted.mockRestore();
    }
  });

  describe('in Restricted Mode', () => {
    /** Runs `test` untrusted, with a fresh folder outside the workspace. */
    async function untrusted(test: (outside: string) => Promise<void>) {
      const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'foam-outside-'));
      const trusted = vi.spyOn(workspace, 'isTrusted', 'get');
      trusted.mockReturnValue(false);
      try {
        await test(outside);
      } finally {
        trusted.mockRestore();
        fs.rmSync(outside, { recursive: true, force: true });
      }
    }

    it('refuses a note in a folder that symlinks out of the workspace', () =>
      untrusted(async outside => {
        const link = getUriInWorkspace(path.basename(outside));
        fs.symlinkSync(outside, link.toFsPath());
        try {
          await expect(
            NoteFactory.createNote(
              makeFoamMock(),
              options('x', link.joinPath('note.md'))
            )
          ).rejects.toThrow(/Restricted Mode/);
          expect(fs.readdirSync(outside)).toEqual([]);
        } finally {
          fs.unlinkSync(link.toFsPath());
        }
      }));

    it('leaves a file outside the workspace alone when asked to overwrite it through a symlink', () =>
      untrusted(async outside => {
        fs.writeFileSync(path.join(outside, 'note.md'), 'keep');
        const link = getUriInWorkspace(path.basename(outside));
        fs.symlinkSync(outside, link.toFsPath());
        try {
          await expect(
            NoteFactory.createNote(makeFoamMock(), {
              ...options('x', link.joinPath('note.md')),
              onFileExists: 'overwrite',
            })
          ).rejects.toThrow(/Restricted Mode/);
          expect(fs.readFileSync(path.join(outside, 'note.md'), 'utf8')).toBe(
            'keep'
          );
        } finally {
          fs.unlinkSync(link.toFsPath());
        }
      }));

    it('leaves a file outside the workspace alone when asked to overwrite it through a symlink and ..', () =>
      untrusted(async outside => {
        const name = `${path.basename(outside)}.md`;
        fs.mkdirSync(path.join(outside, 'inner'));
        fs.writeFileSync(path.join(outside, name), 'keep');
        const link = getUriInWorkspace(path.basename(outside));
        fs.symlinkSync(path.join(outside, 'inner'), link.toFsPath());
        try {
          await expect(
            NoteFactory.createNote(makeFoamMock(), {
              ...options('x', URI.file(`${link.toFsPath()}/../${name}`)),
              onFileExists: 'overwrite',
            })
          ).rejects.toThrow(/Restricted Mode/);
          expect(fs.readFileSync(path.join(outside, name), 'utf8')).toBe(
            'keep'
          );
        } finally {
          await closeEditors();
          fs.unlinkSync(link.toFsPath());
          await deleteFile(getUriInWorkspace(name));
        }
      }));

    it('refuses a note whose path climbs out of a new folder onto a symlink out of the workspace', () =>
      untrusted(async outside => {
        const folder = getUriInWorkspace(`${path.basename(outside)}-real`);
        const link = getUriInWorkspace(`${path.basename(outside)}-link`);
        fs.mkdirSync(path.join(folder.toFsPath(), 'inner'), {
          recursive: true,
        });
        fs.symlinkSync(path.join(folder.toFsPath(), 'inner'), link.toFsPath());
        fs.symlinkSync(outside, path.join(folder.toFsPath(), 'out'));
        try {
          await expect(
            NoteFactory.createNote(
              makeFoamMock(),
              options('x', URI.file(`${link.toFsPath()}/../new/../out/note.md`))
            )
          ).rejects.toThrow(/Restricted Mode/);
          expect(fs.readdirSync(outside)).toEqual([]);
        } finally {
          await closeEditors();
          fs.unlinkSync(link.toFsPath());
          fs.rmSync(folder.toFsPath(), { recursive: true, force: true });
        }
      }));

    it('refuses a note that is a dangling symlink out of the workspace', () =>
      untrusted(async outside => {
        const note = getUriInWorkspace();
        fs.symlinkSync(path.join(outside, 'planted.md'), note.toFsPath());
        try {
          await expect(
            NoteFactory.createNote(makeFoamMock(), options('x', note))
          ).rejects.toThrow(/Restricted Mode/);
          expect(fs.readdirSync(outside)).toEqual([]);
        } finally {
          fs.unlinkSync(note.toFsPath());
        }
      }));

    it('creates a note through a symlink that stays inside the workspace', () =>
      untrusted(async outside => {
        const folder = getUriInWorkspace(`${path.basename(outside)}-real`);
        const link = getUriInWorkspace(`${path.basename(outside)}-link`);
        fs.mkdirSync(folder.toFsPath());
        fs.symlinkSync(folder.toFsPath(), link.toFsPath());
        try {
          const result = await NoteFactory.createNote(
            makeFoamMock(),
            options('x', link.joinPath('note.md'))
          );

          expect(result.didCreateFile).toBe(true);
          expect(fs.existsSync(path.join(folder.toFsPath(), 'note.md'))).toBe(
            true
          );
        } finally {
          await closeEditors();
          fs.unlinkSync(link.toFsPath());
          fs.rmSync(folder.toFsPath(), { recursive: true, force: true });
        }
      }));
  });
});
