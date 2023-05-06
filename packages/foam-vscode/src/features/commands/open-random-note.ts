import { ExtensionContext, commands, window } from 'vscode';
import { focusNote } from '../../utils';
import { Foam } from '../../core/model/foam';

export default async function activate(
  context: ExtensionContext,
  foamPromise: Promise<Foam>
) {
  context.subscriptions.push(
    commands.registerCommand('foam-vscode.open-random-note', async () => {
      const foam = await foamPromise;
      const currentFile = window.activeTextEditor?.document.uri.path;
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
