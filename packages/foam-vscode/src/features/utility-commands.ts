import * as vscode from 'vscode';
import { FoamFeature } from '../types';
import { URI } from '../core/model/uri';
import { fromVsCodeUri, toVsCodeUri } from '../utils/vsc-utils';
import { createNoteForPlaceholderWikilink } from './create-from-template';

export const OPEN_COMMAND = {
  command: 'foam-vscode.open-resource',
  title: 'Foam: Open Resource',

  execute: async (params: { uri: URI }) => {
    const { uri } = params;
    switch (uri.scheme) {
      case 'file':
        return vscode.commands.executeCommand('vscode.open', toVsCodeUri(uri));

      case 'placeholder':
        const title = uri.path.split('/').slice(-1)[0];

        const basedir =
          vscode.workspace.workspaceFolders.length > 0
            ? fromVsCodeUri(vscode.workspace.workspaceFolders[0].uri)
            : fromVsCodeUri(vscode.window.activeTextEditor?.document.uri)
            ? URI.getDir(
                fromVsCodeUri(vscode.window.activeTextEditor!.document.uri)
              )
            : undefined;

        if (basedir === undefined) {
          return;
        }

        const target = URI.createResourceUriFromPlaceholder(basedir, uri);

        await createNoteForPlaceholderWikilink(title, target);
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
      vscode.commands.registerCommand(
        OPEN_COMMAND.command,
        OPEN_COMMAND.execute
      )
    );
  },
};

export default feature;
