import { commands, window } from 'vscode';
import {
  closeEditors,
  createFile,
  deleteFile,
  getUriInWorkspace,
} from '../../test/test-utils-vscode';

describe('create-note command', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('fails if neither note path nor template path are provided', () => {
    expect(() =>
      commands.executeCommand('foam-vscode.create-note')
    ).rejects.toThrow('Either notePath or templatePath must be provided');
  });

  it.skip('gives precedence to the template over the text', async () => {
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
    expect(window.activeTextEditor?.document.getText()).toEqual('Template A');
    expect(window.activeTextEditor.document.uri.path).toEqual(target.path);
    await deleteFile(target);
    await deleteFile(templateA.uri);
  });

  it('focuses on the newly created note', async () => {
    const target = getUriInWorkspace();
    await commands.executeCommand('foam-vscode.create-note', {
      notePath: target.path,
      text: 'hello',
    });
    expect(window.activeTextEditor?.document.getText()).toEqual('hello');
    expect(window.activeTextEditor.document.uri.path).toEqual(target.path);
    await deleteFile(target);
  });

  it('supports variables', async () => {
    const target = getUriInWorkspace();
    await commands.executeCommand('foam-vscode.create-note', {
      notePath: target.path,
      text: 'hello ${FOAM_TITLE}',
      variables: { FOAM_TITLE: 'world' },
    });
    expect(window.activeTextEditor?.document.getText()).toEqual('hello world');
    expect(window.activeTextEditor.document.uri.path).toEqual(target.path);
    await deleteFile(target);
  });

  it('supports date variables', async () => {
    const target = getUriInWorkspace();
    await commands.executeCommand('foam-vscode.create-note', {
      notePath: target.path,
      text: 'hello ${FOAM_DATE_YEAR}',
      date: '2021-10-01',
    });
    expect(window.activeTextEditor?.document.getText()).toEqual('hello 2021');
    expect(window.activeTextEditor.document.uri.path).toEqual(target.path);
    await deleteFile(target);
  });

  it('supports various options to deal with existing notes', async () => {
    const target = await createFile('hello');
    await commands.executeCommand('foam-vscode.create-note', {
      notePath: target.uri.path,
      text: 'test overwrite',
      onFileExists: 'overwrite',
    });
    expect(window.activeTextEditor?.document.getText()).toEqual(
      'test overwrite'
    );
    expect(window.activeTextEditor.document.uri.path).toEqual(target.uri.path);

    await closeEditors();
    await commands.executeCommand('foam-vscode.create-note', {
      notePath: target.uri.path,
      text: 'test open',
      onFileExists: 'open',
    });
    expect(window.activeTextEditor?.document.getText()).toEqual(
      'test overwrite'
    );
    expect(window.activeTextEditor.document.uri.path).toEqual(target.uri.path);

    await closeEditors();
    await commands.executeCommand('foam-vscode.create-note', {
      notePath: target.uri.path,
      text: 'test cancel',
      onFileExists: 'cancel',
    });
    expect(window.activeTextEditor).toBeUndefined();

    await closeEditors();
    await commands.executeCommand('foam-vscode.create-note', {
      notePath: target.uri.path,
      text: 'test overwrite 2',
      onFileExists: 'overwrite',
    });
    expect(window.activeTextEditor?.document.getText()).toEqual(
      'test overwrite 2'
    );
    expect(window.activeTextEditor.document.uri.path).toEqual(target.uri.path);

    const spy = jest
      .spyOn(window, 'showQuickPick')
      .mockImplementationOnce(jest.fn(() => Promise.resolve(undefined)));
    await closeEditors();
    await commands.executeCommand('foam-vscode.create-note', {
      notePath: target.uri.path,
      text: 'let me think',
      onFileExists: 'ask',
    });
    expect(spy).toBeCalled();

    await deleteFile(target);
  });
});
