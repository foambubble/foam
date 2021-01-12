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
        const notes = foam.notes
          .getNotes()
          .map(note => note.uri.path)
          .filter(notePath => notePath !== currentFile);
        if (notes.length === 0) {
          window.showInformationMessage(
            'Could not find another note to open. If you believe this is a bug, please file an issue.'
          );
          return;
        }
        const randomNote = notes[Math.floor(Math.random() * notes.length)];
        focusNote(randomNote, false);
      })
    );
  },
};

export default feature;
