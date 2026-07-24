/* @unit-ready */
import * as vscode from 'vscode';
import { fromVsCodeUri, toVsCodeUri } from '../utils/vsc-utils';
import { buildWatchGlob } from '../utils/watch-glob';
import { getUriInWorkspace } from '../../test/test-utils-vscode';

/**
 * End-to-end check that an extension-scoped watcher (buildWatchGlob +
 * RelativePattern) only surfaces events for the file types Foam cares about
 * See issue #1668.
 */
describe('#1668 - Scoped file-system watcher', () => {
  it('reports events for watched extensions and ignores others', async () => {
    const folder = vscode.workspace.workspaceFolders[0];
    const glob = buildWatchGlob(['.md', '.pdf']);
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(folder.uri, glob)
    );

    const created: string[] = [];
    const sub = watcher.onDidCreate(uri =>
      created.push(fromVsCodeUri(uri).path)
    );

    const mdUri = getUriInWorkspace('scoped-note.md');
    const jsUri = getUriInWorkspace('node_modules', 'pkg', 'index.js');
    const encoder = new TextEncoder();

    try {
      await vscode.workspace.fs.writeFile(
        toVsCodeUri(mdUri),
        encoder.encode('# note')
      );
      await vscode.workspace.fs.writeFile(
        toVsCodeUri(jsUri),
        encoder.encode('module.exports = {}')
      );

      // The .md is watched; the node_modules .js is not.
      expect(created).toContain(mdUri.path);
      expect(created).not.toContain(jsUri.path);
    } finally {
      sub.dispose();
      watcher.dispose();
      await vscode.workspace.fs.delete(toVsCodeUri(mdUri));
      await vscode.workspace.fs.delete(toVsCodeUri(jsUri));
    }
  });
});
