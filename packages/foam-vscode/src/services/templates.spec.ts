import { Selection, ViewColumn, window } from 'vscode';
import { fromVsCodeUri } from '../utils/vsc-utils';
import { NoteFactory } from '../services/templates';
import {
  closeEditors,
  createFile,
  deleteFile,
  getUriInWorkspace,
  showInEditor,
} from '../test/test-utils-vscode';
import { Resolver } from './variable-resolver';
import { fileExists } from './editor';

describe('Create note from template', () => {
  beforeEach(async () => {
    await closeEditors();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('User flow', () => {
    it('should ask a user to confirm the path if note already exists', async () => {
      const templateA = await createFile('Template A', [
        '.foam',
        'templates',
        'template-a.md',
      ]);
      const spy = jest
        .spyOn(window, 'showInputBox')
        .mockImplementationOnce(jest.fn(() => Promise.resolve(undefined)));

      const fileA = await createFile('Content of file A');
      await NoteFactory.createFromTemplate(
        templateA.uri,
        new Resolver(new Map(), new Date()),
        fileA.uri
      );
      expect(spy).toBeCalledWith(
        expect.objectContaining({
          prompt: `Enter the filename for the new note`,
        })
      );

      await deleteFile(fileA);
      await deleteFile(templateA);
    });

    it('should not ask a user for path if defined in template', async () => {
      const uri = getUriInWorkspace();
      const templateA = await createFile(
        `---
foam_template: # foam template metadata
  filepath: ${uri.toFsPath()}
---
`,
        ['.foam', 'templates', 'template-with-path.md']
      );
      const spy = jest
        .spyOn(window, 'showInputBox')
        .mockImplementationOnce(jest.fn(() => Promise.resolve(undefined)));

      await NoteFactory.createFromTemplate(
        templateA.uri,
        new Resolver(new Map(), new Date())
      );
      expect(spy).toHaveBeenCalledTimes(0);

      await deleteFile(uri);
      await deleteFile(templateA);
    });

    it('should focus the editor on the newly created note', async () => {
      const templateA = await createFile('Template A', [
        '.foam',
        'templates',
        'template-a.md',
      ]);
      const target = getUriInWorkspace();
      await NoteFactory.createFromTemplate(
        templateA.uri,
        new Resolver(new Map(), new Date()),
        target
      );
      expect(fromVsCodeUri(window.activeTextEditor.document.uri)).toEqual(
        target
      );

      await deleteFile(target);
      await deleteFile(templateA);
    });
  });

  it('should expand variables when using a template', async () => {
    // eslint-disable-next-line no-template-curly-in-string
    const template = await createFile('${FOAM_DATE_YEAR}', [
      '.foam',
      'templates',
      'template-with-variables.md',
    ]);
    const target = getUriInWorkspace();
    await NoteFactory.createFromTemplate(
      template.uri,
      new Resolver(new Map(), new Date()),
      target
    );

    expect(window.activeTextEditor.document.getText()).toEqual(
      `${new Date().getFullYear()}`
    );

    await deleteFile(target);
    await deleteFile(template);
  });

  describe('Creation with active text selection', () => {
    it('should open created note in a new column if there was a selection', async () => {
      const templateA = await createFile('Template A', [
        '.foam',
        'templates',
        'template-a.md',
      ]);
      const file = await createFile('This is my first file: for new file');
      const { editor } = await showInEditor(file.uri);
      editor.selection = new Selection(0, 23, 0, 35);
      const target = getUriInWorkspace();
      await NoteFactory.createFromTemplate(
        templateA.uri,
        new Resolver(new Map(), new Date()),
        target
      );
      expect(window.activeTextEditor.viewColumn).toEqual(ViewColumn.Two);
      expect(fromVsCodeUri(window.visibleTextEditors[0].document.uri)).toEqual(
        file.uri
      );
      expect(fromVsCodeUri(window.visibleTextEditors[1].document.uri)).toEqual(
        target
      );

      await deleteFile(target);
      await deleteFile(templateA);
      await closeEditors();
    });

    it('should replace selection with a link to the newly created note', async () => {
      const template = await createFile(
        // eslint-disable-next-line no-template-curly-in-string
        'Hello ${FOAM_SELECTED_TEXT} ${FOAM_SELECTED_TEXT}',
        ['.foam', 'templates', 'template-with-selection.md']
      );
      const file = await createFile('This is my first file: World');
      const { editor } = await showInEditor(file.uri);
      editor.selection = new Selection(0, 23, 0, 28);
      const target = getUriInWorkspace();
      await NoteFactory.createFromTemplate(
        template.uri,
        new Resolver(new Map(), new Date()),
        target
      );
      expect(window.activeTextEditor.document.getText()).toEqual(
        'Hello World World'
      );
      expect(window.visibleTextEditors[0].document.getText()).toEqual(
        `This is my first file: [[${target.getName()}]]`
      );
      await deleteFile(template.uri);
    });
  });
});

describe('NoteFactory.createNote', () => {
  beforeEach(async () => {
    await closeEditors();
  });
  it('should create a new note', async () => {
    const target = getUriInWorkspace();
    await NoteFactory.createNote(
      target,
      'Hello World',
      new Resolver(new Map(), new Date())
    );
    expect(await fileExists(target)).toBeTruthy();
    expect(window.activeTextEditor.document.getText()).toEqual('Hello World');

    await deleteFile(target);
  });

  it('should support not replacing the selection with a link to the newly created note', async () => {
    const file = await createFile('This is my first file: World');
    const { editor } = await showInEditor(file.uri);
    editor.selection = new Selection(0, 23, 0, 28);
    const target = getUriInWorkspace();
    await NoteFactory.createNote(
      target,
      'Hello ${FOAM_SELECTED_TEXT} ${FOAM_SELECTED_TEXT}', // eslint-disable-line no-template-curly-in-string
      new Resolver(new Map(), new Date()),
      undefined,
      false
    );
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
    await NoteFactory.createNote(
      target,
      'Hello ${FOAM_SELECTED_TEXT} ${FOAM_SELECTED_TEXT}', // eslint-disable-line no-template-curly-in-string
      new Resolver(new Map(), new Date()),
      undefined,
      true
    );
    expect(window.activeTextEditor.document.getText()).toEqual(
      'Hello World World'
    );
    expect(window.visibleTextEditors[0].document.getText()).toEqual(
      `This is my first file: [[${target.getName()}]]`
    );
    await deleteFile(file.uri);
    await deleteFile(target);
  });
});
