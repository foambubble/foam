import { Selection, ViewColumn, window, workspace } from 'vscode';
import path from 'path';
import { isWindows } from '../utils';
import { URI } from '../core/model/uri';
import { fromVsCodeUri } from '../utils/vsc-utils';
import { determineDefaultFilepath, NoteFactory } from '../services/templates';
import {
  closeEditors,
  createFile,
  deleteFile,
  getUriInWorkspace,
  showInEditor,
} from '../test/test-utils-vscode';
import { Resolver } from './variable-resolver';

type Awaited<T> = T extends PromiseLike<infer U> ? U : T;

describe('Create note from template', () => {
  let templateA: Awaited<ReturnType<typeof createFile>>;

  beforeAll(async () => {
    templateA = await createFile('Template A', [
      '.foam',
      'templates',
      'template-a.md',
    ]);
  });

  afterAll(async () => {
    await deleteFile(templateA.uri);
  });

  beforeEach(async () => {
    await closeEditors();
  });

  describe('User flow', () => {
    it('should ask a user to confirm the path if note already exists', async () => {
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

      await deleteFile(fileA.uri);
    });

    it('should focus the editor on the newly created note', async () => {
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
  });

  describe('Creation with active text selection', () => {
    it('should populate FOAM_SELECTED_TEXT with the current selection', async () => {
      const file = await createFile('Content of first file');
      const { editor } = await showInEditor(file.uri);
      editor.selection = new Selection(0, 11, 1, 0);
      const target = getUriInWorkspace();
      const resolver = new Resolver(new Map(), new Date());
      await NoteFactory.createFromTemplate(templateA.uri, resolver, target);
      expect(await resolver.resolve('FOAM_SELECTED_TEXT')).toEqual(
        'first file'
      );
    });

    it('should open created note in a new column if there was a selection', async () => {
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
        `This is my first file: [[${URI.getBasename(target)}]]`
      );
    });
  });
});

describe('determineDefaultFilepath', () => {
  test('Absolute filepath metadata is unchanged', () => {
    const absolutePath = isWindows
      ? 'C:\\absolute_path\\journal\\My Note Title.md'
      : '/absolute_path/journal/My Note Title.md';

    const resolvedValues = new Map<string, string>();
    const templateMetadata = new Map<string, string>();
    templateMetadata.set('filepath', absolutePath);

    const resultFilepath = determineDefaultFilepath(
      resolvedValues,
      templateMetadata
    );

    expect(URI.toFsPath(resultFilepath)).toMatch(absolutePath);
  });

  test('Relative filepath metadata is appended to current directory', () => {
    const relativePath = isWindows
      ? 'journal\\My Note Title.md'
      : 'journal/My Note Title.md';

    const resolvedValues = new Map<string, string>();
    const templateMetadata = new Map<string, string>();
    templateMetadata.set('filepath', relativePath);

    const resultFilepath = determineDefaultFilepath(
      resolvedValues,
      templateMetadata
    );

    const expectedPath = path.join(
      URI.toFsPath(fromVsCodeUri(workspace.workspaceFolders[0].uri)),
      relativePath
    );

    expect(URI.toFsPath(resultFilepath)).toMatch(expectedPath);
  });
});
