import * as vscode from 'vscode';
import { FoamFeature } from '../types';
import { commands } from 'vscode';
import { createNoteFromPlaceholder, focusNote, isSome } from '../utils';
import { URI } from 'foam-core';
import { toVsCodeUri } from '../utils/vsc-utils';

export const OPEN_COMMAND = {
  command: 'foam-vscode.open-resource',
  title: 'Foam: Open Resource',

  execute: async (params: { uri: URI }) => {
    const { uri } = params;
    switch (uri.scheme) {
      case 'file':
        return vscode.commands.executeCommand('vscode.open', toVsCodeUri(uri));

      case 'placeholder':
        const newNote = await createNoteFromPlaceholder(uri);

        if (isSome(newNote)) {
          const title = uri.path.split('/').slice(-1);
          const snippet = new vscode.SnippetString(
            '# ${1:' + title + '}\n\n$0'
          );
          await focusNote(newNote, true);
          await vscode.window.activeTextEditor.insertSnippet(snippet);
        }
        return;
    }
  },

  asURI: (uri: URI) =>
    vscode.Uri.parse(`command:${OPEN_COMMAND.command}`).with({
      query: encodeURIComponent(JSON.stringify({ uri: URI.create(uri) })),
    }),
};

const feature: FoamFeature = {
  activate: (context: vscode.ExtensionContext) => {
    context.subscriptions.push(
      commands.registerCommand(OPEN_COMMAND.command, OPEN_COMMAND.execute)
    );
  },
};

export default feature;
