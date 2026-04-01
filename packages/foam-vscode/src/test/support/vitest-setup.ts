import * as vscode from 'vscode';

// Set up initial workspace configuration expected by tests
await vscode.workspace
  .getConfiguration()
  .update('foam.edit.linkReferenceDefinitions', 'off');
