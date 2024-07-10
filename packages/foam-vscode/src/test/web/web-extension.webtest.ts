/*global suite:readonly*/

import * as assert from 'assert';
import * as vscode from 'vscode';
suite('Foam Web Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('Foam extension is loaded', () => {
    assert.ok(vscode.extensions.getExtension('foam.foam-vscode'));
  });
});
