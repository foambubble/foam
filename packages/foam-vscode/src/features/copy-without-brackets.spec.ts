import { env, Position, Selection, commands } from 'vscode';
import { createFile, showInEditor } from '../test/test-utils-vscode';

describe('copyWithoutBrackets', () => {
  it('should get the input from the active editor selection', async () => {
    const { uri } = await createFile('This is my [[test-content]].');
    const { editor } = await showInEditor(uri);
    editor.selection = new Selection(new Position(0, 0), new Position(1, 0));
    await commands.executeCommand('foam-vscode.copy-without-brackets');
    const value = await env.clipboard.readText();
    expect(value).toEqual('This is my Test Content.');
  });
});
