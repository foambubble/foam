/* @unit-ready */
import { Selection, window } from 'vscode';
import {
  NoteFactory,
  getTemplatesDir,
  getTemplates,
} from '../services/templates';
import {
  closeEditors,
  createFile,
  deleteFile,
  getUriInWorkspace,
  showInEditor,
  withModifiedFoamConfiguration,
} from '../test/test-utils-vscode';
import { Resolver } from './variable-resolver';
import { fileExists } from './editor';

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
      'Hello ${FOAM_SELECTED_TEXT} ${FOAM_SELECTED_TEXT}',
      new Resolver(new Map(), new Date()),
      undefined,
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
      'Hello ${FOAM_SELECTED_TEXT} ${FOAM_SELECTED_TEXT}',
      new Resolver(new Map(), new Date()),
      undefined,
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

describe('getTemplatesDir', () => {
  it('should return the default .foam/templates directory', () => {
    const dir = getTemplatesDir();
    expect(dir.path).toContain('.foam/templates');
  });

  it('should return the custom templates directory when foam.templates.folder is set', async () => {
    await withModifiedFoamConfiguration(
      'templates.folder',
      'custom/templates',
      async () => {
        const dir = getTemplatesDir();
        expect(dir.path).toContain('custom/templates');
        expect(dir.path).not.toContain('.foam/templates');
      }
    );
  });
});

describe('getTemplates', () => {
  it('should find templates in a custom folder when foam.templates.folder is set', async () => {
    await withModifiedFoamConfiguration(
      'templates.folder',
      'custom-tpl',
      async () => {
        const template = await createFile('# Custom template', [
          'custom-tpl',
          'my-template.md',
        ]);
        try {
          const templates = await getTemplates();
          const paths = templates.map(t => t.path);
          expect(paths.some(p => p.includes('custom-tpl/my-template.md'))).toBe(
            true
          );
        } finally {
          await deleteFile(template.uri);
        }
      }
    );
  });
});
