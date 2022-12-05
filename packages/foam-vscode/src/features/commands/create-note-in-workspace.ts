import * as vscode from 'vscode';
import { FoamFeature } from '../../types';

import { Foam } from '../../core/model/foam';
import { CreateNoteArgs } from '../../services/creation';
import { createNote } from '../../services/creation';
import { getWorkspaceFolder } from '../../settings';

export const CREATE_NOTE_IN_ROOT_COMMAND = {
  command: 'foam-vscode.create-note-in-workspace',
  title: 'Foam: Create Note In Workspace',

  asURI: (args: CreateNoteArgs) =>
    vscode.Uri.parse(`command:${CREATE_NOTE_IN_ROOT_COMMAND.command}`).with({
      query: encodeURIComponent(JSON.stringify(args)),
    }),
};

const feature: FoamFeature = {
  activate: (context: vscode.ExtensionContext, foamPromise: Promise<Foam>) => {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        CREATE_NOTE_IN_ROOT_COMMAND.command,
        () => {
          const noteDir = getWorkspaceFolder()
          createNote({noteDir});
        }
      )
    );
  },
};

export default feature;
