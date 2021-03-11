import * as vscode from 'vscode';
import { FoamFeature } from '../types';
import { commands } from 'vscode';
import { URI } from 'foam-core';
import { createNoteFromPlacehoder, focusNote, isSome } from '../utils';

export const OPEN_COMMAND = {
  command: 'foam-vscode.open-resource',
  title: 'Foam: Open Resource',
  asURI: (resource: vscode.Uri) =>
    URI.from({
      scheme: 'command',
      path: OPEN_COMMAND.command,
      query: encodeURIComponent(
        JSON.stringify({
          resource: resource,
        })
      ),
    }),
};

const feature: FoamFeature = {
  activate: (context: vscode.ExtensionContext) => {
    context.subscriptions.push(
      commands.registerCommand(
        OPEN_COMMAND.command,
        async (params: { resource: vscode.Uri }) => {
          const { resource } = params;
          switch (resource.scheme) {
            case 'file':
              return vscode.commands.executeCommand('vscode.open', resource);

            case 'placeholder':
              const newNote = await createNoteFromPlacehoder(resource);

              if (isSome(newNote)) {
                const title = resource.path.split('/').slice(-1);
                const snippet = new vscode.SnippetString(
                  '# ${1:' + title + '}\n\n$0'
                );
                await focusNote(newNote, true);
                await vscode.window.activeTextEditor.insertSnippet(snippet);
              }
              return;

            case 'attachment':
              return vscode.window.showInformationMessage(
                'Opening attachments is not supported yet'
              );
          }
        }
      )
    );
  },
};

export default feature;
