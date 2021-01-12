import { Foam } from 'foam-core';
import { ExtensionContext, commands, window } from 'vscode';
import { FoamFeature } from '../types';
import { focusNote } from '../utils';

const feature: FoamFeature = {
  activate: (context: ExtensionContext, foamPromise: Promise<Foam>) => {
    context.subscriptions.push(
      commands.registerCommand('foam-vscode.open-random-note', async () => {
        const foam = await foamPromise;
        const currentFile = window.activeTextEditor?.document.uri.path;
        const notes = foam.notes.getNotes();
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

        focusNote(notes[randomNoteIndex].uri.path, false);
      })
    );
  },
};

export default feature;
