import {
  ExtensionContext,
  QuickPickItem,
  commands,
  window,
  workspace as vsCodeWorkspace,
} from 'vscode';
import { Foam, FoamWorkspace, URI } from '@foam/core';
import { toVsCodeUri } from '../../utils/vsc-utils';
import { getTelemetry } from '../../services/telemetry';
import { OPEN_COMMAND } from './open-resource';

export const GO_TO_NOTE_COMMAND = {
  command: 'foam-vscode.go-to-note',
  title: 'Foam: Go to Note',
};

export interface NoteQuickPickItem extends QuickPickItem {
  uri: URI;
}

/**
 * One item per note, ordered by title.
 *
 * The title, the path and the note's aliases all go into fields the quick pick
 * matches against, so VS Code's own fuzzy filter finds a note by any of them —
 * the way `Go to File` finds a file by its name or its path.
 */
export function createNoteItems(workspace: FoamWorkspace): NoteQuickPickItem[] {
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
    .sort((a, b) => a.label.localeCompare(b.label));
}

export async function goToNote(workspace: FoamWorkspace) {
  const picked = await window.showQuickPick(createNoteItems(workspace), {
    placeHolder: 'Search notes by title, alias or path',
    matchOnDescription: true,
    matchOnDetail: true,
  });
  if (!picked) {
    return;
  }
  // Opening through the Foam command keeps the editor-association handling
  // that `open-resource` already does (#1742).
  return commands.executeCommand(OPEN_COMMAND.command, { uri: picked.uri });
}

export default async function activate(
  context: ExtensionContext,
  foamPromise: Promise<Foam>
) {
  context.subscriptions.push(
    commands.registerCommand(GO_TO_NOTE_COMMAND.command, async () => {
      getTelemetry()?.trackCommand(GO_TO_NOTE_COMMAND.command);
      const foam = await foamPromise;
      return goToNote(foam.workspace);
    })
  );
}
