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
        const notes = foam.notes.getNotes().map(note => note.uri.path);

        let randomNoteIndex = Math.floor(Math.random() * notes.length);
        if (notes[randomNoteIndex] === currentFile) {
          notes.splice(randomNoteIndex, 1);
          randomNoteIndex = Math.floor(Math.random() * notes.length);
        }

        if (notes.length > 0) {
          focusNote(notes[randomNoteIndex], false);
        } else {
          window.showInformationMessage(
            'Could not find another note to open. If you believe this is a bug, please file an issue.'
          );
        }
      })
    );
  },
};

export default feature;
