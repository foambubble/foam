import * as vscode from 'vscode';
import { Foam, FoamWorkspace, Note } from 'foam-core';
import { FilteredNotesConfigGroupBy, getOrphansConfig } from '../settings';
import { FoamFeature } from '../types';
import { FilteredNotesProvider } from './filtered-notes';

const feature: FoamFeature = {
  activate: async (
    context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {
    const foam = await foamPromise;
    const workspacesFsPaths = vscode.workspace.workspaceFolders.map(
      dir => dir.uri.fsPath
    );
    const provider = new FilteredNotesProvider(
      foam.workspace,
      foam.services.dataStore,
      'orphans',
      'orphan',
      (note: Note) => isOrphan(foam.workspace, note),
      {
        ...getOrphansConfig(),
        workspacesFsPaths,
      }
    );

    context.subscriptions.push(
      vscode.window.registerTreeDataProvider('foam-vscode.orphans', provider),
      vscode.commands.registerCommand(
        'foam-vscode.group-orphans-by-folder',
        () => provider.setGroupBy(FilteredNotesConfigGroupBy.Folder)
      ),
      vscode.commands.registerCommand('foam-vscode.group-orphans-off', () =>
        provider.setGroupBy(FilteredNotesConfigGroupBy.Off)
      ),
      foam.workspace.onDidAdd(() => provider.refresh()),
      foam.workspace.onDidUpdate(() => provider.refresh()),
      foam.workspace.onDidDelete(() => provider.refresh())
    );
  },
};
export default feature;

export function isOrphan(workspace: FoamWorkspace, note: Note) {
  return workspace.getConnections(note.uri).length === 0;
}
