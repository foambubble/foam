import * as vscode from 'vscode';
import { getTestFoam } from '../vscode-mock';
import { initializeFoamFeatures } from '../foam-extension-test-host';

// Set up initial workspace configuration expected by tests
await vscode.workspace
  .getConfiguration()
  .update('foam.edit.linkReferenceDefinitions', 'off');

// Activate all Foam features once for the entire test suite
await initializeFoamFeatures(await getTestFoam());
