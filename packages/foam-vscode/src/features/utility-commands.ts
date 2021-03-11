import * as vscode from 'vscode';
import { FoamFeature } from '../types';
import { commands } from 'vscode';
import { URI } from 'foam-core';
import { createNoteFromPlacehoder, isSome } from '../utils';

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
              const materializedPlaceholder = await createNoteFromPlacehoder(
                resource
              );

              if (isSome(materializedPlaceholder)) {
                await vscode.window.showTextDocument(materializedPlaceholder, {
                  preserveFocus: false,
                  preview: false,
                });
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
