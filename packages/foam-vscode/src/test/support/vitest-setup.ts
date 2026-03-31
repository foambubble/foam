import * as vscode from 'vscode';

// Set up initial workspace configuration expected by tests
vscode.workspace
  .getConfiguration()
  .update('foam.edit.linkReferenceDefinitions', 'off');
