import * as vscode from 'vscode';
import { FoamFeature } from '../../types';
import { URI } from '../../core/model/uri';
import { fromVsCodeUri, toVsCodeUri } from '../../utils/vsc-utils';
import { NoteFactory } from '../../services/templates';
import { Foam } from '../../core/model/foam';

export const OPEN_COMMAND = {
  command: 'foam-vscode.open-resource',
  title: 'Foam: Open Resource',

  asURI: (uri: URI, chooseTemplate = false) =>
    vscode.Uri.parse(`command:${OPEN_COMMAND.command}`).with({
      query: encodeURIComponent(JSON.stringify({ uri, chooseTemplate })),
    }),
};

const feature: FoamFeature = {
  activate: (context: vscode.ExtensionContext, foamPromise: Promise<Foam>) => {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        OPEN_COMMAND.command,
        async (params: { uri: URI; chooseTemplate: boolean }) => {
          const uri = new URI(params.uri);
          switch (uri.scheme) {
            case 'file': {
              const targetUri =
                uri.path === vscode.window.activeTextEditor?.document.uri.path
                  ? vscode.window.activeTextEditor?.document.uri
                  : toVsCodeUri(uri.asPlain());
              // if the doc is already open, reuse the same colunm
              const targetEditor = vscode.window.visibleTextEditors.find(
                ed => targetUri.path === ed.document.uri.path
              );
              const column = targetEditor?.viewColumn;
              return vscode.commands.executeCommand('vscode.open', targetUri);
            }
            case 'placeholder': {
              const title = uri.getName();
              if (uri.isAbsolute()) {
                return NoteFactory.createForPlaceholderWikilink(
                  title,
                  URI.file(uri.path),
                  params.chooseTemplate
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
              await NoteFactory.createForPlaceholderWikilink(
                title,
                target,
                params.chooseTemplate
              );
              return;
            }
          }
        }
      )
    );
  },
};

export default feature;
