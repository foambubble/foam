import * as vscode from 'vscode';
import { FoamFeature } from '../types';
import { URI } from '../core/model/uri';
import { fromVsCodeUri, toVsCodeUri } from '../utils/vsc-utils';
import { NoteFactory } from '../services/templates';
import { Foam } from '../core/model/foam';

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
              const targetEditor = vscode.window.visibleTextEditors.find(
                ed => targetUri.path === ed.document.uri.path
              );
              const column = targetEditor?.viewColumn;
              return vscode.window.showTextDocument(targetUri, {
                viewColumn: column,
              });
            }
            case 'placeholder': {
              const title = uri.getName();
              if (uri.isAbsolute()) {
                return NoteFactory.createForPlaceholderWikilink(
                  title,
                  URI.file(uri.path)
                );
              }
              const basedir =
                vscode.workspace.workspaceFolders.length > 0
                  ? vscode.workspace.workspaceFolders[0].uri
                  : vscode.window.activeTextEditor?.document.uri
                  ? vscode.window.activeTextEditor!.document.uri
                  : undefined;
              if (basedir === undefined) {
                return;
              }
              const target = fromVsCodeUri(basedir)
                .resolve(uri, true)
                .changeExtension('', '.md');
              await NoteFactory.createForPlaceholderWikilink(title, target);
              return;
            }
          }
        }
      )
    );
  },
};

export default feature;
