import * as vscode from 'vscode';
import { FoamFeature } from '../../types';

import { Foam } from '../../core/model/foam';
import { CreateNoteArgs } from '../../services/creation';
import { createNote } from '../../services/creation';

export const CREATE_NOTE_COMMAND = {
  command: 'foam-vscode.create-note',
  title: 'Foam: Create Note',

  asURI: (args: CreateNoteArgs) =>
    vscode.Uri.parse(`command:${CREATE_NOTE_COMMAND.command}`).with({
      query: encodeURIComponent(JSON.stringify(args)),
    }),
};

const feature: FoamFeature = {
  activate: (context: vscode.ExtensionContext, foamPromise: Promise<Foam>) => {
    context.subscriptions.push(
      vscode.commands.registerCommand(CREATE_NOTE_COMMAND.command, () => {
        createNote(undefined);
      })
    );
  },
};

export default feature;
