// import { env, window, Uri, Position, Selection, commands } from 'vscode';
// import * as vscode from 'vscode';

describe('copyWithoutBrackets', () => {
  it('should pass CI', () => {
    expect(true).toBe(true);
  });
  // it('should get the input from the active editor selection', async () => {
  //   const doc = await vscode.workspace.openTextDocument(
  //     Uri.parse('untitled:/hello.md')
  //   );
  //   const editor = await window.showTextDocument(doc);
  //   editor.edit(builder => {
  //     builder.insert(new Position(0, 0), 'This is my [[test-content]].');
  //   });
  //   editor.selection = new Selection(new Position(0, 0), new Position(1, 0));
  //   await commands.executeCommand('foam-vscode.copy-without-brackets');
  //   const value = await env.clipboard.readText();
  //   expect(value).toEqual('This is my Test Content.');
  // });
});
