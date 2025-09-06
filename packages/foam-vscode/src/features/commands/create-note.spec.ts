/* @unit-ready */
import { commands, window, workspace } from 'vscode';
import { URI } from '../../core/model/uri';
import { asAbsoluteWorkspaceUri, readFile } from '../../services/editor';
import {
  closeEditors,
  createFile,
  deleteFile,
  expectSameUri,
  getUriInWorkspace,
  showInEditor,
} from '../../test/test-utils-vscode';
import { fromVsCodeUri } from '../../utils/vsc-utils';
import { CREATE_NOTE_COMMAND, createNote } from './create-note';
import { Location } from '../../core/model/location';
import { Range } from '../../core/model/range';
import { ResourceLink } from '../../core/model/note';
import { createMarkdownParser } from '../../core/services/markdown-parser';

describe('create-note command', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('uses sensible defaults to work even without params', async () => {
    const spy = jest
      .spyOn(window, 'showInputBox')
      .mockImplementationOnce(jest.fn(() => Promise.resolve('Test note')));

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
      text: 'hello ${FOAM_TITLE}', // eslint-disable-line no-template-curly-in-string
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
      text: 'hello ${FOAM_DATE_YEAR}', // eslint-disable-line no-template-curly-in-string
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

    const spy = jest
      .spyOn(window, 'showInputBox')
      .mockImplementationOnce(jest.fn(() => Promise.resolve(undefined)));
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
    const spy = jest
      .spyOn(window, 'showInputBox')
      .mockImplementationOnce(jest.fn(() => Promise.resolve(undefined)));
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
        {} as any
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
        {} as any
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
