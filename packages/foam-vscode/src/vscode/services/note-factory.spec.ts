/* @unit-ready */
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
});
