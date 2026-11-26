import {
  Disposable,
  ExtensionContext,
  QuickPickItem,
  commands,
  window,
  workspace as vsCodeWorkspace,
} from 'vscode';
import { Foam, FoamWorkspace, URI } from '@foam/core';
import { toVsCodeUri } from '../../utils/vsc-utils';
import { getTelemetry } from '../../services/telemetry';
import { getActiveTabUri, onDidChangeActiveTab } from '../../services/editor';
import { OPEN_COMMAND } from './open-resource';
import { NoteRecency } from './note-recency';

export const GO_TO_NOTE_COMMAND = {
  command: 'foam-vscode.go-to-note',
  title: 'Foam: Go to Note',
};

export interface NoteQuickPickItem extends QuickPickItem {
  uri: URI;
}

/**
 * One item per note: the ones the user has been on most recently first, then
 * the rest by title.
 *
 * The title, the path and the note's aliases all go into fields the quick pick
 * matches against, so VS Code's own fuzzy filter finds a note by any of them —
 * the way `Go to File` finds a file by its name or its path.
 */
export function createNoteItems(
  workspace: FoamWorkspace,
  recency: NoteRecency
): NoteQuickPickItem[] {
  return workspace
    .list()
    .filter(resource => resource.type === 'note')
    .map(resource => ({
      label: resource.title,
      description: vsCodeWorkspace.asRelativePath(toVsCodeUri(resource.uri)),
      detail:
        resource.aliases.length > 0
          ? `Alias: ${resource.aliases.map(alias => alias.title).join(', ')}`
          : undefined,
      uri: resource.uri,
    }))
    .sort(
      (a, b) =>
        recency.rank(a.uri) - recency.rank(b.uri) ||
        a.label.localeCompare(b.label)
    );
}

export async function goToNote(
  workspace: FoamWorkspace,
  recency: NoteRecency
) {
  const picked = await window.showQuickPick(
    createNoteItems(workspace, recency),
    {
      placeHolder: 'Search notes by title, alias or path',
      matchOnDescription: true,
      matchOnDetail: true,
    }
  );
  if (!picked) {
    return;
  }
  // Opening through the Foam command keeps the editor-association handling
  // that `open-resource` already does (#1742).
  return commands.executeCommand(OPEN_COMMAND.command, { uri: picked.uri });
}

/**
 * Keeps `recency` in step with the note the user is on. Called once up front so
 * a window restored onto a note opens the picker on that note rather than
 * alphabetically.
 */
function trackVisitedNotes(
  workspace: FoamWorkspace,
  recency: NoteRecency
): Disposable {
  const record = () => {
    const uri = getActiveTabUri(workspace);
    const resource = uri ? workspace.find(uri) : undefined;
    if (resource?.type === 'note') {
      // The resource's own URI, not the tab's, so the key always matches the
      // one `createNoteItems` ranks by.
      recency.visit(resource.uri);
    }
  };
  record();
  return onDidChangeActiveTab(record);
}

export default async function activate(
  context: ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const recency = new NoteRecency();
  context.subscriptions.push(
    commands.registerCommand(GO_TO_NOTE_COMMAND.command, async () => {
      getTelemetry()?.trackCommand(GO_TO_NOTE_COMMAND.command);
      const foam = await foamPromise;
      return goToNote(foam.workspace, recency);
    })
  );
  const foam = await foamPromise;
  context.subscriptions.push(trackVisitedNotes(foam.workspace, recency));
}
