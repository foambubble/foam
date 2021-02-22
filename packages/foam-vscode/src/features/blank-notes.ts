import * as vscode from 'vscode';
import { Foam, Note } from 'foam-core';
import { FilteredNotesConfigGroupBy, getBlankNotesConfig } from '../settings';
import { FoamFeature } from '../types';
import { FilteredNotesProvider } from './filtered-notes';
import { not } from 'micromatch';

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
      'blank-notes',
      'blank note',
      isBlank,
      {
        ...getBlankNotesConfig(),
        workspacesFsPaths,
      }
    );

    context.subscriptions.push(
      vscode.window.registerTreeDataProvider(
        'foam-vscode.blank-notes',
        provider
      ),
      vscode.commands.registerCommand(
        'foam-vscode.group-blank-notes-by-folder',
        () => provider.setGroupBy(FilteredNotesConfigGroupBy.Folder)
      ),
      vscode.commands.registerCommand('foam-vscode.group-blank-notes-off', () =>
        provider.setGroupBy(FilteredNotesConfigGroupBy.Off)
      ),
      foam.workspace.onDidAdd(() => provider.refresh()),
      foam.workspace.onDidUpdate(() => provider.refresh()),
      foam.workspace.onDidDelete(() => provider.refresh())
    );
  },
};

export default feature;

export function isBlank(note: Note) {
  if (!note.source.text) {
    return true;
  }

  const trimmedText = note.source.text.trim();
  const lines = trimmedText.split('\n').map(line => line.trim());
  const noLines = lines.length == 0;
  console.log(lines);
  console.log('nolines', noLines);
  if (noLines) {
    return true;
  }

  if (lines.length == 1) {
    const onlyLineIsEmpty = lines[0].length === 0;

    if (onlyLineIsEmpty) {
      return true;
    }

    const onlyLineIsTitle = !!/^#.*/gm.exec(lines[0]);

    if (onlyLineIsTitle) {
      return true;
    }
  }

  return false;
}
