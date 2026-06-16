import { ExtensionContext, commands, window } from 'vscode';
import { Foam } from '@foam/core';
import { focusNote, getActiveTabUri } from '../../services/editor';
import { getTelemetry } from '../../services/telemetry';

export default async function activate(
  context: ExtensionContext,
  foamPromise: Promise<Foam>
) {
  context.subscriptions.push(
    commands.registerCommand('foam-vscode.open-random-note', async () => {
      getTelemetry()?.trackCommand('foam-vscode.open-random-note');
      const foam = await foamPromise;
      const currentFile = getActiveTabUri(foam.workspace)?.path;
      const notes = foam.workspace.list().filter(r => r.uri.isMarkdown());
      if (notes.length <= 1) {
        window.showInformationMessage(
          'Could not find another note to open. If you believe this is a bug, please file an issue.'
        );
        return;
      }

      let randomNoteIndex = Math.floor(Math.random() * notes.length);
      if (notes[randomNoteIndex].uri.path === currentFile) {
        randomNoteIndex = (randomNoteIndex + 1) % notes.length;
      }

      focusNote(notes[randomNoteIndex].uri, false);
    })
  );
}
