/* @unit-ready */
import { existsSync } from 'fs';
import { Selection, commands, window, workspace } from 'vscode';
import { URI } from '@foam/core';
import {
  asAbsoluteWorkspaceUri,
  readFile,
  writeFile,
} from '../../services/editor';
import {
  closeEditors,
  createFile,
  deleteFile,
  expectSameUri,
  getActiveTabViewType,
  getUriInWorkspace,
  makeFoamMock,
  showInEditor,
  withMarkdownEditorAssociation,
  withModifiedFoamConfiguration,
  withSecondRoot,
} from '../../../test/test-utils-vscode';
import { fromVsCodeUri } from '../../utils/vsc-utils';
import { CREATE_NOTE_COMMAND, createNote } from './create-note';
import { Location } from '@foam/core';
import { Range } from '@foam/core';
import { ResourceLink } from '@foam/core';
import { createMarkdownParser } from '@foam/core';

describe('create-note command', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('uses sensible defaults to work even without params', async () => {
    const spy = vi
      .spyOn(window, 'showInputBox')
      .mockImplementationOnce(vi.fn(() => Promise.resolve('Test note')));

    await commands.executeCommand('foam-vscode.create-note');
    expect(spy).toHaveBeenCalled();
    const target = asAbsoluteWorkspaceUri(URI.file('Test note.md'));
    expectSameUri(target, window.activeTextEditor?.document.uri);
    await deleteFile(target);
  });

  it('gives precedence to the template over the text', async () => {
    const templateA = await createFile('Template A', [
      '.foam',
      'templates',
      'template-for-create-note.md',
    ]);
    const target = getUriInWorkspace();
    await commands.executeCommand('foam-vscode.create-note', {
      notePath: target,
      templatePath: templateA.uri.path,
      text: 'hello',
    });
    expect(window.activeTextEditor.document.getText()).toEqual('Template A');
    expectSameUri(window.activeTextEditor.document.uri, target);
    await deleteFile(target);
    await deleteFile(templateA.uri);
  });

  it('focuses on the newly created note', async () => {
    const target = getUriInWorkspace();
    await commands.executeCommand('foam-vscode.create-note', {
      notePath: target,
      text: 'hello',
    });
    expect(window.activeTextEditor.document.getText()).toEqual('hello');
    expectSameUri(window.activeTextEditor.document.uri, target);
    await deleteFile(target);
  });

  it('supports variables', async () => {
    const target = getUriInWorkspace();
    await commands.executeCommand('foam-vscode.create-note', {
      notePath: target,
      text: 'hello ${FOAM_TITLE}',
      variables: { FOAM_TITLE: 'world' },
    });
    expect(window.activeTextEditor.document.getText()).toEqual('hello world');
    expectSameUri(window.activeTextEditor.document.uri, target);
    await deleteFile(target);
  });

  it('supports date variables', async () => {
    const target = getUriInWorkspace();
    await commands.executeCommand('foam-vscode.create-note', {
      notePath: target,
      text: 'hello ${FOAM_DATE_YEAR}',
      date: '2021-10-01',
    });
    expect(window.activeTextEditor.document.getText()).toEqual('hello 2021');
    expectSameUri(window.activeTextEditor.document.uri, target);
    await deleteFile(target);
  });

  it('supports various options to deal with existing notes', async () => {
    const target = await createFile('hello');
    const content = await readFile(target.uri);
    expect(content).toEqual('hello');

    await commands.executeCommand('foam-vscode.create-note', {
      notePath: target.uri,
      text: 'test overwrite',
      onFileExists: 'overwrite',
    });
    expect(window.activeTextEditor.document.getText()).toEqual(
      'test overwrite'
    );
    expectSameUri(window.activeTextEditor.document.uri, target.uri);

    await closeEditors();
    await commands.executeCommand('foam-vscode.create-note', {
      notePath: target.uri,
      text: 'test open',
      onFileExists: 'open',
    });
    expect(window.activeTextEditor.document.getText()).toEqual(
      'test overwrite'
    );
    expectSameUri(window.activeTextEditor.document.uri, target.uri);

    await closeEditors();
    await commands.executeCommand('foam-vscode.create-note', {
      notePath: target.uri,
      text: 'test cancel',
      onFileExists: 'cancel',
    });
    expect(window.activeTextEditor).toBeUndefined();

    const spy = vi
      .spyOn(window, 'showInputBox')
      .mockImplementationOnce(vi.fn(() => Promise.resolve(undefined)));
    await closeEditors();
    await commands.executeCommand('foam-vscode.create-note', {
      notePath: target.uri,
      text: 'test ask',
      onFileExists: 'ask',
    });
    expect(spy).toHaveBeenCalled();

    await deleteFile(target);
  });

  it('supports various options to deal with relative paths', async () => {
    const TEST_FOLDER = 'create-note-tests';
    const base = await createFile('relative path tests base file', [
      TEST_FOLDER,
      'base-file.md',
    ]);

    await closeEditors();
    await showInEditor(base.uri);
    expectSameUri(window.activeTextEditor.document.uri, base.uri);
    await commands.executeCommand('foam-vscode.create-note', {
      notePath: 'note-resolved-from-root.md',
      text: 'test resolving from root',
      onRelativeNotePath: 'resolve-from-root',
    });
    expectSameUri(
      window.activeTextEditor.document.uri,
      fromVsCodeUri(workspace.workspaceFolders?.[0].uri).joinPath(
        'note-resolved-from-root.md'
      )
    );
    expect(window.activeTextEditor.document.getText()).toEqual(
      'test resolving from root'
    );

    await closeEditors();
    await showInEditor(base.uri);
    expectSameUri(window.activeTextEditor.document.uri, base.uri);
    await commands.executeCommand('foam-vscode.create-note', {
      notePath: 'note-resolved-from-current-dir.md',
      text: 'test resolving from current dir',
      onRelativeNotePath: 'resolve-from-current-dir',
    });
    expectSameUri(
      window.activeTextEditor.document.uri,
      fromVsCodeUri(workspace.workspaceFolders?.[0].uri).joinPath(
        TEST_FOLDER,
        'note-resolved-from-current-dir.md'
      )
    );
    expect(window.activeTextEditor.document.getText()).toEqual(
      'test resolving from current dir'
    );

    await closeEditors();
    await showInEditor(base.uri);
    await commands.executeCommand('foam-vscode.create-note', {
      notePath: 'note-that-should-not-be-created.md',
      text: 'test cancelling',
      onRelativeNotePath: 'cancel',
    });
    expectSameUri(window.activeTextEditor.document.uri, base.uri);

    await closeEditors();
    await showInEditor(base.uri);
    const spy = vi
      .spyOn(window, 'showInputBox')
      .mockImplementationOnce(vi.fn(() => Promise.resolve(undefined)));
    await commands.executeCommand('foam-vscode.create-note', {
      notePath: 'ask-me-about-it.md',
      text: 'test asking',
      onRelativeNotePath: 'ask',
    });
    expect(spy).toHaveBeenCalled();

    // await deleteFile(base);
  });

  it('throws an error if the template file does not exist', async () => {
    const nonExistentTemplatePath = '/non/existent/template/path.md';
    await expect(
      commands.executeCommand('foam-vscode.create-note', {
        notePath: 'note-with-missing-template.md',
        templatePath: nonExistentTemplatePath,
        text: 'should not matter',
      })
    ).rejects.toThrow(
      `Failed to load template (file://${nonExistentTemplatePath}): Template file not found: file://${nonExistentTemplatePath}`
    );
  });

  it('throws an error if the template file does not exist (relative path)', async () => {
    try {
      const nonExistentTemplatePath = 'relative/non-existent-template.md';
      await commands.executeCommand('foam-vscode.create-note', {
        notePath: 'note-with-missing-template-relative.md',
        templatePath: nonExistentTemplatePath,
        text: 'should not matter',
      });
      throw new Error('Expected an error to be thrown');
    } catch (error) {
      expect(error.message).toContain(`Failed to load template`); // eslint-disable-line jest/no-conditional-expect
    }
  });

  describe('content resolution', () => {
    it('resolves Foam variables and lets VS Code expand the snippet syntax', async () => {
      const template = await createFile(
        '# ${FOAM_TITLE}\n\n${1:foo} $2 ${TM_FILENAME_BASE}',
        ['.foam', 'templates', 'snippet-syntax-template.md']
      );
      const target = getUriInWorkspace();
      await commands.executeCommand('foam-vscode.create-note', {
        notePath: target,
        templatePath: template.uri.path,
        title: 'world',
      });
      // Inserted with `insertSnippet`, so VS Code resolves the snippet syntax.
      expect(window.activeTextEditor.document.getText()).toEqual(
        `# world\n\nfoo  ${target.getName()}`
      );
      await deleteFile(target);
      await deleteFile(template.uri);
    });

    it('expands the snippet in a text editor even when Markdown is associated with another editor (#1742)', async () => {
      const template = await createFile(
        '# ${FOAM_TITLE}\n\n${1:foo} $2 ${TM_FILENAME_BASE}',
        ['.foam', 'templates', 'associated-editor-template.md']
      );
      const target = getUriInWorkspace();

      await withMarkdownEditorAssociation(async () => {
        await commands.executeCommand('foam-vscode.create-note', {
          notePath: target,
          templatePath: template.uri.path,
          title: 'world',
        });

        // The template is inserted as a snippet, which needs a text editor.
        expect(getActiveTabViewType()).toBeUndefined();
        expect(window.activeTextEditor.document.getText()).toEqual(
          `# world\n\nfoo  ${target.getName()}`
        );
      });

      await deleteFile(target);
      await deleteFile(template.uri);
    });

    it('fills FOAM_SELECTED_TEXT from the selection and replaces it with a link', async () => {
      const source = await createFile('This is my first file: World');
      const { editor } = await showInEditor(source.uri);
      editor.selection = new Selection(0, 23, 0, 28);
      const target = getUriInWorkspace();
      await commands.executeCommand('foam-vscode.create-note', {
        notePath: target,
        text: 'Hello ${FOAM_SELECTED_TEXT}',
      });
      expect(window.activeTextEditor.document.getText()).toEqual('Hello World');
      const { doc } = await showInEditor(source.uri);
      expect(doc.getText()).toEqual(
        `This is my first file: [[${target.getName()}]]`
      );
      await deleteFile(source.uri);
      await deleteFile(target);
    });

    it('opens an untitled editor without asking for a title when the template has no filepath and no title variable (#1243)', async () => {
      const template = await createFile('Plain ${1:tabstop} body', [
        '.foam',
        'templates',
        'no-target-template.md',
      ]);
      const spy = vi.spyOn(window, 'showInputBox');
      await commands.executeCommand('foam-vscode.create-note', {
        templatePath: template.uri.path,
      });
      expect(spy).not.toHaveBeenCalled();
      expect(window.activeTextEditor.document.uri.scheme).toEqual('untitled');
      // Inserted with `insertSnippet`, so the tabstop default is expanded.
      expect(window.activeTextEditor.document.getText()).toEqual(
        'Plain tabstop body'
      );
      await closeEditors();
      await deleteFile(template.uri);
    });

    it('asks for the title once and opens an unsaved editor named after it when the template has no filepath (#1243)', async () => {
      const template = await createFile('# ${FOAM_TITLE}\n\nbody', [
        '.foam',
        'templates',
        'titled-no-target-template.md',
      ]);
      const spy = vi
        .spyOn(window, 'showInputBox')
        .mockImplementationOnce(() => Promise.resolve('Unsaved Title'));
      await commands.executeCommand('foam-vscode.create-note', {
        templatePath: template.uri.path,
        onRelativeNotePath: 'resolve-from-root',
      });
      expect(spy).toHaveBeenCalledTimes(1);
      const target = asAbsoluteWorkspaceUri(URI.file('Unsaved Title.md'));
      const doc = window.activeTextEditor.document;
      expect(doc.uri.scheme).toEqual('untitled');
      expect(doc.uri.path).toEqual(target.path);
      expect(doc.getText()).toEqual('# Unsaved Title\n\nbody');
      expect(existsSync(target.toFsPath())).toBe(false);
      await closeEditors();
      await deleteFile(template.uri);
    });

    it('asks for another path before opening the unsaved editor when the title-derived file exists (#1243)', async () => {
      const existing = await createFile('ORIGINAL', ['Taken Title.md']);
      const template = await createFile('# ${FOAM_TITLE}', [
        '.foam',
        'templates',
        'titled-existing-target-template.md',
      ]);
      const alternative = asAbsoluteWorkspaceUri(URI.file('Free Title.md'));
      const spy = vi
        .spyOn(window, 'showInputBox')
        .mockImplementationOnce(() => Promise.resolve('Taken Title'))
        .mockImplementationOnce(() => Promise.resolve(alternative.toFsPath()));
      await commands.executeCommand('foam-vscode.create-note', {
        templatePath: template.uri.path,
        onRelativeNotePath: 'resolve-from-root',
      });
      expect(spy).toHaveBeenCalledTimes(2);
      const doc = window.activeTextEditor.document;
      expect(doc.uri.scheme).toEqual('untitled');
      expect(doc.uri.path).toEqual(alternative.path);
      expect(await readFile(existing.uri)).toEqual('ORIGINAL');
      await closeEditors();
      await deleteFile(existing.uri);
      await deleteFile(template.uri);
    });

    it('with overwrite, opens the existing title-derived file with the new content and deletes nothing before saving (#1243)', async () => {
      const existing = await createFile('ORIGINAL', ['Kept Title.md']);
      const template = await createFile('# ${FOAM_TITLE}', [
        '.foam',
        'templates',
        'titled-overwrite-template.md',
      ]);
      vi.spyOn(window, 'showInputBox').mockImplementationOnce(() =>
        Promise.resolve('Kept Title')
      );
      await commands.executeCommand('foam-vscode.create-note', {
        templatePath: template.uri.path,
        onRelativeNotePath: 'resolve-from-root',
        onFileExists: 'overwrite',
      });
      const doc = window.activeTextEditor.document;
      expect(doc.uri.scheme).toEqual('file');
      expect(doc.uri.path).toEqual(existing.uri.path);
      expect(doc.getText()).toEqual('# Kept Title');
      expect(existsSync(existing.uri.toFsPath())).toBe(true);
      // The mock writes edits through to disk and never marks a document
      // dirty, so only VS Code (e2e) can show the original surviving until
      // the save.
      if (doc.isDirty) {
        expect(await readFile(existing.uri)).toEqual('ORIGINAL'); // eslint-disable-line jest/no-conditional-expect
      }
      await doc.save();
      expect(await readFile(existing.uri)).toEqual('# Kept Title');
      await closeEditors();
      await deleteFile(existing.uri);
      await deleteFile(template.uri);
    });

    it('with overwrite, asks for another path instead of writing over an open unsaved note (#1243)', async () => {
      const template = await createFile('# ${FOAM_TITLE}', [
        '.foam',
        'templates',
        'titled-held-template.md',
      ]);
      const held = asAbsoluteWorkspaceUri(URI.file('Held Title.md'));
      const other = asAbsoluteWorkspaceUri(URI.file('Elsewhere.md'));
      const spy = vi
        .spyOn(window, 'showInputBox')
        .mockImplementationOnce(() => Promise.resolve('Held Title'))
        .mockImplementationOnce(() => Promise.resolve(other.toFsPath()));
      await commands.executeCommand('foam-vscode.create-note', {
        templatePath: template.uri.path,
        onRelativeNotePath: 'resolve-from-root',
      });
      const unsavedDoc = window.activeTextEditor.document;
      await commands.executeCommand('foam-vscode.create-note', {
        notePath: held,
        text: 'written note',
        onFileExists: 'overwrite',
      });
      expect(spy).toHaveBeenCalledTimes(2);
      expect(existsSync(held.toFsPath())).toBe(false);
      expect(unsavedDoc.getText()).toEqual('# Held Title');
      expect(await readFile(other)).toEqual('written note');
      await closeEditors();
      await deleteFile(other);
      await deleteFile(template.uri);
    });

    it('asks again when the collision prompt is answered with the same path (#1243)', async () => {
      const template = await createFile('# ${FOAM_TITLE}', [
        '.foam',
        'templates',
        'titled-same-answer-template.md',
      ]);
      const first = asAbsoluteWorkspaceUri(URI.file('Same Title.md'));
      const other = asAbsoluteWorkspaceUri(URI.file('Different Title.md'));
      const spy = vi
        .spyOn(window, 'showInputBox')
        .mockImplementationOnce(() => Promise.resolve('Same Title'))
        .mockImplementationOnce(() => Promise.resolve('Same Title'))
        .mockImplementationOnce(() => Promise.resolve(first.toFsPath()))
        .mockImplementationOnce(() => Promise.resolve(other.toFsPath()));
      const args = {
        templatePath: template.uri.path,
        onRelativeNotePath: 'resolve-from-root',
      };
      await commands.executeCommand('foam-vscode.create-note', args);
      const firstDoc = window.activeTextEditor.document;
      await commands.executeCommand('foam-vscode.create-note', args);
      expect(spy).toHaveBeenCalledTimes(4);
      expect(firstDoc.getText()).toEqual('# Same Title');
      expect(window.activeTextEditor.document.uri.path).toEqual(other.path);
      await closeEditors();
      await deleteFile(template.uri);
    });

    it('asks for another path when an unsaved note with the same title is already open (#1243)', async () => {
      const template = await createFile('# ${FOAM_TITLE}', [
        '.foam',
        'templates',
        'titled-twice-template.md',
      ]);
      const first = asAbsoluteWorkspaceUri(URI.file('Twice Title.md'));
      const second = asAbsoluteWorkspaceUri(URI.file('Other Title.md'));
      const spy = vi
        .spyOn(window, 'showInputBox')
        .mockImplementationOnce(() => Promise.resolve('Twice Title'))
        .mockImplementationOnce(() => Promise.resolve('Twice Title'))
        .mockImplementationOnce(() => Promise.resolve(second.toFsPath()));
      const args = {
        templatePath: template.uri.path,
        onRelativeNotePath: 'resolve-from-root',
      };
      await commands.executeCommand('foam-vscode.create-note', args);
      const firstDoc = window.activeTextEditor.document;
      await commands.executeCommand('foam-vscode.create-note', args);
      expect(spy).toHaveBeenCalledTimes(3);
      expect(firstDoc.uri.path).toEqual(first.path);
      expect(firstDoc.getText()).toEqual('# Twice Title');
      const secondDoc = window.activeTextEditor.document;
      expect(secondDoc.uri.scheme).toEqual('untitled');
      expect(secondDoc.uri.path).toEqual(second.path);
      await closeEditors();
      await deleteFile(template.uri);
    });

    it('fills FOAM_SELECTED_TEXT into the unsaved note and leaves the selection as it was (#1243)', async () => {
      const source = await createFile('This is my first file: World');
      const { editor } = await showInEditor(source.uri);
      editor.selection = new Selection(0, 23, 0, 28);
      const template = await createFile('Hello ${FOAM_SELECTED_TEXT}', [
        '.foam',
        'templates',
        'selection-unsaved-template.md',
      ]);
      await commands.executeCommand('foam-vscode.create-note', {
        templatePath: template.uri.path,
      });
      expect(window.activeTextEditor.document.uri.scheme).toEqual('untitled');
      expect(window.activeTextEditor.document.getText()).toEqual('Hello World');
      const { doc } = await showInEditor(source.uri);
      expect(doc.getText()).toEqual('This is my first file: World');
      await closeEditors();
      await deleteFile(source.uri);
      await deleteFile(template.uri);
    });

    it('creates a file named from the title prompt from the unmodified Create New Template scaffold (#1243)', async () => {
      const spy = vi
        .spyOn(window, 'showInputBox')
        .mockImplementationOnce((options: any) =>
          Promise.resolve(options.value)
        )
        .mockImplementationOnce(() => Promise.resolve('Scaffold Note'))
        .mockImplementationOnce(() => Promise.resolve('Scaffold Note 2'));
      await commands.executeCommand('foam-vscode.create-new-template');
      const scaffoldUri = asAbsoluteWorkspaceUri(
        URI.file('.foam/templates/new-template.md')
      );
      const args = {
        templatePath: scaffoldUri.path,
        onRelativeNotePath: 'resolve-from-root',
      };

      await commands.executeCommand('foam-vscode.create-note', args);
      expect(spy).toHaveBeenCalledTimes(2);
      const target = asAbsoluteWorkspaceUri(URI.file('Scaffold Note.md'));
      expect(window.activeTextEditor.document.uri.scheme).toEqual('file');
      expectSameUri(target, window.activeTextEditor?.document.uri);

      await commands.executeCommand('foam-vscode.create-note', args);
      expect(spy).toHaveBeenCalledTimes(3);
      const second = asAbsoluteWorkspaceUri(URI.file('Scaffold Note 2.md'));
      expectSameUri(second, window.activeTextEditor?.document.uri);
      expect(existsSync(target.toFsPath())).toBe(true);
      expect(existsSync(second.toFsPath())).toBe(true);
      await closeEditors();
      await deleteFile(target);
      await deleteFile(second);
      await deleteFile(scaffoldUri);
    });

    it('appends FOAM_SELECTED_TEXT given as a variable once', async () => {
      const target = getUriInWorkspace();
      await commands.executeCommand('foam-vscode.create-note', {
        notePath: target,
        text: 'Hello',
        variables: { FOAM_SELECTED_TEXT: 'sel' },
      });
      expect(window.activeTextEditor.document.getText()).toEqual('Hello\nsel');
      await deleteFile(target);
    });

    it('resolves Foam variables in the content returned by a JS template', async () => {
      const template = await createFile(
        `async function createNote() {
  return { filepath: 'js-template-note.md', content: '# \${FOAM_TITLE}' };
}`,
        ['.foam', 'templates', 'js-content-template.js']
      );
      const result: Awaited<ReturnType<typeof createNote>> =
        await commands.executeCommand('foam-vscode.create-note', {
          templatePath: template.uri.path,
          title: 'JS Title',
        });
      expect(result.uri.path).toMatch(/js-template-note.md$/);
      expect(window.activeTextEditor.document.getText()).toEqual('# JS Title');
      await deleteFile(result.uri);
      await deleteFile(template.uri);
    });
  });

  describe('note paths in a multi-root workspace', () => {
    const createWithFilepath = async (
      root: URI,
      filepath: string,
      newNotePath: 'root' | 'currentDir' = 'root'
    ) => {
      const template = root.joinPath('.foam', 'templates', 'global.md');
      await writeFile(
        template,
        `---\nfoam_template:\n  filepath: '${filepath}'\n---\n# Global note`
      );
      let created: URI;
      await withModifiedFoamConfiguration(
        'files.newNotePath',
        newNotePath,
        async () => {
          created = (
            await createNote({ templatePath: template }, makeFoamMock())
          ).uri;
        }
      );
      return created;
    };

    it('creates the note in the root named after the leading slash of the filepath (#1711)', async () => {
      await withSecondRoot(async root => {
        const uri = await createWithFilepath(
          root,
          `/${root.getBasename()}/inbox/global-note.md`
        );
        expectSameUri(uri, root.joinPath('inbox', 'global-note.md'));
      });
    });

    it('creates the note in the named root even when new notes go to the current directory', async () => {
      await withSecondRoot(async root => {
        const current = await createFile('# Current', [
          'current-dir',
          'current.md',
        ]);
        await showInEditor(current.uri);
        try {
          const uri = await createWithFilepath(
            root,
            `/${root.getBasename()}/inbox/global-note.md`,
            'currentDir'
          );
          expectSameUri(uri, root.joinPath('inbox', 'global-note.md'));
        } finally {
          await closeEditors();
          await deleteFile(current.uri);
        }
      });
    });

    it('still creates the note in the named root when the filepath has no leading slash', async () => {
      await withSecondRoot(async root => {
        const uri = await createWithFilepath(
          root,
          `${root.getBasename()}/inbox/global-note.md`
        );
        expectSameUri(uri, root.joinPath('inbox', 'global-note.md'));
      });
    });

    it('creates the note for a leading-slash placeholder where the link points, not in the named root', async () => {
      await withSecondRoot(async root => {
        const name = root.getBasename();
        const source = await createFile(`see [[/${name}/idea]]`);
        const link = createMarkdownParser().parse(source.uri, source.content)
          .links[0];
        const command = CREATE_NOTE_COMMAND.forPlaceholder(
          Location.forObjectWithRange(source.uri, link),
          '.md',
          { text: 'x' }
        );
        const expected = getUriInWorkspace(name, 'idea.md');
        try {
          const { uri } = await createNote(command.params, makeFoamMock());
          expectSameUri(uri, expected);
        } finally {
          await closeEditors();
          await deleteFile(expected);
          await deleteFile(source.uri);
        }
      });
    });

    it('creates a note from a leading-slash notePath in the named root', async () => {
      await withSecondRoot(async root => {
        const { uri } = await createNote(
          { notePath: `/${root.getBasename()}/from-note-path.md`, text: 'x' },
          makeFoamMock()
        );
        expectSameUri(uri, root.joinPath('from-note-path.md'));
      });
    });
  });

  it('creates a note with absolute path within the workspace', async () => {
    await commands.executeCommand('foam-vscode.create-note', {
      notePath: '/note-in-workspace.md',
      text: 'hello workspace',
    });
    expect(window.activeTextEditor.document.getText()).toEqual(
      'hello workspace'
    );
    expectSameUri(
      window.activeTextEditor.document.uri,
      fromVsCodeUri(workspace.workspaceFolders?.[0].uri).joinPath(
        'note-in-workspace.md'
      )
    );
    await deleteFile(
      fromVsCodeUri(workspace.workspaceFolders?.[0].uri).joinPath(
        'note-in-workspace.md'
      )
    );
  });
});

describe('factories', () => {
  describe('forPlaceholder', () => {
    it('adds the .md extension to notes created for placeholders', async () => {
      await closeEditors();
      const link: ResourceLink = {
        type: 'wikilink',
        rawText: '[[my-placeholder]]',
        range: Range.create(0, 0, 0, 0),
        isEmbed: false,
      };
      const command = CREATE_NOTE_COMMAND.forPlaceholder(
        Location.forObjectWithRange(URI.file(''), link),
        '.md'
      );
      await commands.executeCommand(command.name, command.params);

      const doc = window.activeTextEditor.document;
      expect(doc.uri.path).toMatch(/my-placeholder.md$/);
      expect(doc.getText()).toMatch(/^# my-placeholder/);
    });

    // A `new-note.md` template with a `filepath` is how a workspace directs new
    // notes into a subfolder — the documented alternative to a dedicated
    // setting for it. See issues #106 and #1701.
    it('honours the filepath of the default new-note template', async () => {
      await closeEditors();
      const template = await createFile(
        `---
foam_template:
  filepath: 'knowledge-base/\${FOAM_TITLE}.md'
---
# \${FOAM_TITLE}`,
        ['.foam', 'templates', 'new-note.md']
      );
      const link: ResourceLink = {
        type: 'wikilink',
        rawText: '[[subfolder-note]]',
        range: Range.create(0, 0, 0, 0),
        isEmbed: false,
      };
      try {
        const command = CREATE_NOTE_COMMAND.forPlaceholder(
          Location.forObjectWithRange(URI.file(''), link),
          '.md'
        );
        const res: Awaited<ReturnType<typeof createNote>> =
          await commands.executeCommand(command.name, command.params);

        expect(res.didCreateFile).toBeTruthy();
        expect(res.uri.path).toMatch(/knowledge-base\/subfolder-note\.md$/);
        await deleteFile(res.uri);
      } finally {
        await deleteFile(template.uri);
      }
    });

    it('replaces the original placeholder based on the new note identifier (#1327)', async () => {
      await closeEditors();
      const templateA = await createFile(
        `---
foam_template:
  name: 'Example Template'
  description: 'An example for reproducing a bug'
  filepath: '$FOAM_SLUG-world.md'
---`,
        ['.foam', 'templates', 'template-a.md']
      );

      const noteA = await createFile(`this is my [[hello]]`);

      const parser = createMarkdownParser();
      const res = parser.parse(noteA.uri, noteA.content);

      const command = CREATE_NOTE_COMMAND.forPlaceholder(
        Location.forObjectWithRange(noteA.uri, res.links[0]),
        '.md',
        {
          templatePath: templateA.uri.path,
        }
      );
      const results: Awaited<ReturnType<typeof createNote>> =
        await commands.executeCommand(command.name, command.params);
      expect(results.didCreateFile).toBeTruthy();
      expect(results.uri.path).toMatch(/hello-world.md$/);

      const newNoteDoc = window.activeTextEditor.document;
      expect(newNoteDoc.uri.path).toMatch(/hello-world.md$/);

      const { doc } = await showInEditor(noteA.uri);
      expect(doc.getText()).toEqual(`this is my [[hello-world]]`);
    });
  });

  describe('Template filepath with FOAM_CURRENT_DIR', () => {
    it('should create note in current directory using FOAM_CURRENT_DIR variable', async () => {
      // Create a test subdirectory and a file in it
      const noteInSubdir = await createFile('Test content', [
        'subdir',
        'existing-note.md',
      ]);

      // Create a template with FOAM_CURRENT_DIR variable
      const template = await createFile(
        `---
foam_template:
  filepath: \${FOAM_CURRENT_DIR}/\${FOAM_SLUG}.md  
---
# \${FOAM_TITLE}

Template content using FOAM_CURRENT_DIR`,
        ['.foam', 'templates', 'foam-current-dir-template.md']
      );

      // Switch to the file in the subdirectory to set current editor context
      await showInEditor(noteInSubdir.uri);

      // Create a note using the template - FOAM_CURRENT_DIR should resolve to current editor directory
      const resultInSubdir = await createNote(
        {
          templatePath: template.uri.path,
          title: 'My New Note',
        },
        makeFoamMock()
      );
      // The note should be created in the subdir because FOAM_CURRENT_DIR resolves to current editor directory
      expect(resultInSubdir.uri).toEqual(
        noteInSubdir.uri.getDirectory().joinPath('my-new-note.md')
      );

      await closeEditors();
      // Create a note using the template - FOAM_CURRENT_DIR should resolve to current editor directory
      const resultInRoot = await createNote(
        {
          templatePath: template.uri.path,
          title: 'My New Note',
        },
        makeFoamMock()
      );
      // The note should be created in the workspace root because FOAM_CURRENT_DIR resolves to workspace root when no editor is active
      expect(resultInRoot.uri).toEqual(
        fromVsCodeUri(workspace.workspaceFolders[0].uri).joinPath(
          'my-new-note.md'
        )
      );

      // Clean up
      await deleteFile(template.uri);
      await deleteFile(noteInSubdir.uri);
      await deleteFile(resultInRoot.uri);
      await deleteFile(resultInSubdir.uri);
    });
  });
});
