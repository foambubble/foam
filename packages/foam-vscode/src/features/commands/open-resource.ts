import * as vscode from 'vscode';
import { FoamFeature } from '../../types';
import { URI } from '../../core/model/uri';
import { toVsCodeUri } from '../../utils/vsc-utils';
import { Foam } from '../../core/model/foam';

export const OPEN_COMMAND = {
  command: 'foam-vscode.open-resource',
  title: 'Foam: Open Resource',

  asURI: (uri: URI) =>
    vscode.Uri.parse(`command:${OPEN_COMMAND.command}`).with({
      query: encodeURIComponent(JSON.stringify({ uri })),
    }),
};

const feature: FoamFeature = {
  activate: (context: vscode.ExtensionContext, foamPromise: Promise<Foam>) => {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        OPEN_COMMAND.command,
        async (params: { uri: URI }) => {
          const uri = new URI(params.uri);
          switch (uri.scheme) {
            case 'file': {
              const targetUri =
                uri.path === vscode.window.activeTextEditor?.document.uri.path
                  ? vscode.window.activeTextEditor?.document.uri
                  : toVsCodeUri(uri.asPlain());
              return vscode.commands.executeCommand('vscode.open', targetUri);
            }
            case 'placeholder': {
              vscode.window.showErrorMessage(
                "Foam: Can't open placeholder. Use create-note command instead."
              );
            }
          }
        }
      )
    );
  },
};

export default feature;
