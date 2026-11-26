import {
  Disposable,
  ExtensionContext,
  commands,
  window,
  workspace as vsCodeWorkspace,
} from 'vscode';
import { Foam, FoamWorkspace } from '@foam/core';
import { toVsCodeUri } from '../../utils/vsc-utils';
import { getTelemetry } from '../../services/telemetry';
import { getActiveTabUri, onDidChangeActiveTab } from '../../services/editor';
import { createNoteItems } from '../../../go-to-note/note-items';
import { NoteRecency } from '../../../go-to-note/note-recency';
import { OPEN_COMMAND } from './open-resource';

export const GO_TO_NOTE_COMMAND = {
  command: 'foam-vscode.go-to-note',
  title: 'Foam: Go to Note',
};

export async function goToNote(workspace: FoamWorkspace, recency: NoteRecency) {
  const items = createNoteItems(workspace, recency, uri =>
    vsCodeWorkspace.asRelativePath(toVsCodeUri(uri))
  );
  const picked = await window.showQuickPick(items, {
    placeHolder: 'Search notes by title, alias or path',
    matchOnDescription: true,
    matchOnDetail: true,
  });
  if (!picked) {
    return;
  }
  return commands.executeCommand(OPEN_COMMAND.command, { uri: picked.uri });
}

/** Records the active note in `recency` now and whenever the active tab changes. */
function trackVisitedNotes(
  workspace: FoamWorkspace,
  recency: NoteRecency
): Disposable {
  const record = () => {
    const uri = getActiveTabUri(workspace);
    const resource = uri ? workspace.find(uri) : undefined;
    if (resource?.type === 'note') {
      // a tab's URI can differ from the workspace's URI for the same note
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
