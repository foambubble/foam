import { commands, window } from 'vscode';
import { URI } from '../../core/model/uri';
import { asAbsoluteWorkspaceUri, readFile } from '../../services/editor';
import {
  closeEditors,
  createFile,
  deleteFile,
  expectSameUri,
  getUriInWorkspace,
} from '../../test/test-utils-vscode';

describe('create-note command', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('uses sensible defaults to work even without params', async () => {
    const spy = jest
      .spyOn(window, 'showInputBox')
      .mockImplementationOnce(jest.fn(() => Promise.resolve('Test note')));

    await commands.executeCommand('foam-vscode.create-note');
    expect(spy).toBeCalled();
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
      notePath: target.path,
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
      notePath: target.path,
      text: 'hello',
    });
    expect(window.activeTextEditor.document.getText()).toEqual('hello');
    expectSameUri(window.activeTextEditor.document.uri, target);
    await deleteFile(target);
  });

  it('supports variables', async () => {
    const target = getUriInWorkspace();
    await commands.executeCommand('foam-vscode.create-note', {
      notePath: target.path,
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
      notePath: target.path,
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
      notePath: target.uri.path,
      text: 'test overwrite',
      onFileExists: 'overwrite',
    });
    expect(window.activeTextEditor.document.getText()).toEqual(
      'test overwrite'
    );
    expectSameUri(window.activeTextEditor.document.uri, target.uri);

    await closeEditors();
    await commands.executeCommand('foam-vscode.create-note', {
      notePath: target.uri.path,
      text: 'test open',
      onFileExists: 'open',
    });
    expect(window.activeTextEditor.document.getText()).toEqual(
      'test overwrite'
    );
    expectSameUri(window.activeTextEditor.document.uri, target.uri);

    await closeEditors();
    await commands.executeCommand('foam-vscode.create-note', {
      notePath: target.uri.path,
      text: 'test cancel',
      onFileExists: 'cancel',
    });
    expect(window.activeTextEditor).toBeUndefined();

    const spy = jest
      .spyOn(window, 'showInputBox')
      .mockImplementationOnce(jest.fn(() => Promise.resolve(undefined)));
    await closeEditors();
    await commands.executeCommand('foam-vscode.create-note', {
      notePath: target.uri.path,
      text: 'test ask',
      onFileExists: 'ask',
    });
    expect(spy).toBeCalled();

    await deleteFile(target);
  });
});
