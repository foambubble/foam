import * as vscode from 'vscode';
import { closeEditors, createFile } from '../../test/test-utils-vscode';
import { wait } from '../../test/test-utils';

describe('Graph Panel', () => {
  beforeEach(async () => {
    await closeEditors();
  });

  afterEach(async () => {
    await closeEditors();
  });

  it('should create graph beside active editor when panel does not exist', async () => {
    const { uri: noteUri } = await createFile('# Note A', ['note-a.md']);

    // Open a note in column 1
    await vscode.window.showTextDocument(vscode.Uri.file(noteUri.toFsPath()), {
      viewColumn: vscode.ViewColumn.One,
    });

    // Execute show-graph command
    await vscode.commands.executeCommand('foam-vscode.show-graph');

    // Wait a bit for the webview to be created
    await wait(200);

    // Find the graph panel - should be beside (to the right of) column 1
    const graphPanel = vscode.window.tabGroups.all
      .flatMap(group => group.tabs)
      .find(tab => tab.label === 'Foam Graph');

    expect(graphPanel).toBeDefined();
    // ViewColumn.Beside creates a new column to the right, so it should be > column 1
    expect(graphPanel?.group.viewColumn).toBeGreaterThan(vscode.ViewColumn.One);
  });

  it('should create graph in ViewColumn.Two when no active editor', async () => {
    // Make sure no editors are open
    await closeEditors();

    // Execute show-graph command
    await vscode.commands.executeCommand('foam-vscode.show-graph');

    // Wait a bit for the webview to be created
    await wait(200);

    // Find the graph panel
    const graphPanel = vscode.window.tabGroups.all
      .flatMap(group => group.tabs)
      .find(tab => tab.label === 'Foam Graph');

    expect(graphPanel).toBeDefined();
    expect(graphPanel?.group.viewColumn).toBe(vscode.ViewColumn.Two);
  });

  it('should reveal existing graph panel without moving it', async () => {
    const { uri: noteUri } = await createFile('# Note A', ['note-a.md']);

    // Open a note in column 1
    await vscode.window.showTextDocument(vscode.Uri.file(noteUri.toFsPath()), {
      viewColumn: vscode.ViewColumn.One,
    });

    // Create graph (should be beside column 1, so in column 2)
    await vscode.commands.executeCommand('foam-vscode.show-graph');
    await wait(200);

    let graphPanel = vscode.window.tabGroups.all
      .flatMap(group => group.tabs)
      .find(tab => tab.label === 'Foam Graph');

    expect(graphPanel).toBeDefined();
    const originalGraphColumn = graphPanel?.group.viewColumn;

    // Open another note in column 1 (return to first column)
    const { uri: note2Uri } = await createFile('# Note B', ['note-b.md']);
    await vscode.window.showTextDocument(vscode.Uri.file(note2Uri.toFsPath()), {
      viewColumn: vscode.ViewColumn.One,
      preview: false,
    });

    // Focus should be on note in column 1
    expect(vscode.window.activeTextEditor?.viewColumn).toBe(
      vscode.ViewColumn.One
    );

    // Show graph again
    await vscode.commands.executeCommand('foam-vscode.show-graph');
    await wait(200);

    // Find the graph panel - it should still be in its original column
    graphPanel = vscode.window.tabGroups.all
      .flatMap(group => group.tabs)
      .find(tab => tab.label === 'Foam Graph');

    expect(graphPanel).toBeDefined();
    expect(graphPanel?.group.viewColumn).toBe(originalGraphColumn);
  });

  it('should handle the issue reproduction scenario', async () => {
    const { uri: readmeUri } = await createFile('# Readme', ['readme.md']);

    // Step 1-3: Open readme.md
    await vscode.window.showTextDocument(
      vscode.Uri.file(readmeUri.toFsPath()),
      {
        viewColumn: vscode.ViewColumn.One,
      }
    );

    // Step 4: Show graph (should appear beside the editor, not in column 1)
    await vscode.commands.executeCommand('foam-vscode.show-graph');
    await wait(200);

    let graphPanel = vscode.window.tabGroups.all
      .flatMap(group => group.tabs)
      .find(tab => tab.label === 'Foam Graph');

    expect(graphPanel).toBeDefined();
    const originalGraphColumn = graphPanel?.group.viewColumn;
    // Graph should be beside (to the right of) column 1
    expect(originalGraphColumn).toBeGreaterThan(vscode.ViewColumn.One);

    // Step 5: Return focus to readme.md
    await vscode.window.showTextDocument(
      vscode.Uri.file(readmeUri.toFsPath()),
      {
        viewColumn: vscode.ViewColumn.One,
        preserveFocus: false,
      }
    );

    // Step 6: Open markdown preview (simulated by opening another document in the same group as graph)
    // In real scenario, this would be the markdown preview, but for testing we'll verify
    // that the graph stays in its column when we try to reveal it

    // Step 8: Show graph again - it should NOT move
    await vscode.commands.executeCommand('foam-vscode.show-graph');
    await wait(200);

    graphPanel = vscode.window.tabGroups.all
      .flatMap(group => group.tabs)
      .find(tab => tab.label === 'Foam Graph');

    // Graph should still be in its original column, not replaced readme.md
    expect(graphPanel?.group.viewColumn).toBe(originalGraphColumn);
  });
});
