/*global suite:readonly*/

import * as assert from 'assert';
import * as vscode from 'vscode';
suite('Foam Web Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('Foam extension is active', async () => {
    const foamExtension = await vscode.extensions.getExtension(
      'foam.foam-vscode'
    );
    await foamExtension.activate();
    assert.ok(foamExtension.isActive);
  });

  test('Foam commands available', async () => {
    const commands = await vscode.commands.getCommands();

    assert.ok(commands.includes('foam-vscode.connections.focus'));
    assert.ok(
      commands.includes(
        'workbench.actions.treeView.foam-vscode.tags-explorer.refresh'
      )
    );
    assert.ok(commands.includes('foam-vscode.placeholders.focus'));
  });
});
