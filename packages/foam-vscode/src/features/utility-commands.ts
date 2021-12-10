import * as vscode from 'vscode';
import { FoamFeature } from '../types';
import { URI } from '../core/model/uri';
import { fromVsCodeUri, toVsCodeRange, toVsCodeUri } from '../utils/vsc-utils';
import { NoteFactory } from '../services/templates';
import { Foam } from '../core/model/foam';
import { Resource } from '../core/model/note';

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
            case 'file':
              let selection = new vscode.Range(1, 0, 1, 0);
              if (uri.fragment) {
                const foam = await foamPromise;
                const resource = foam.workspace.get(uri);
                const section = Resource.findSection(resource, uri.fragment);
                if (section) {
                  selection = toVsCodeRange(section.range);
                }
              }

              const targetUri =
                uri.path === vscode.window.activeTextEditor?.document.uri.path
                  ? vscode.window.activeTextEditor?.document.uri
                  : toVsCodeUri(uri);

              return vscode.commands.executeCommand('vscode.open', targetUri, {
                selection: selection,
              });

            case 'placeholder':
              const title = uri.path.split('/').slice(-1)[0];

              const basedir =
                vscode.workspace.workspaceFolders.length > 0
                  ? fromVsCodeUri(vscode.workspace.workspaceFolders[0].uri)
                  : fromVsCodeUri(vscode.window.activeTextEditor?.document.uri)
                  ? fromVsCodeUri(vscode.window.activeTextEditor!.document.uri)
                  : undefined;

              if (basedir === undefined) {
                return;
              }

              const target = basedir.resolve(uri.path);

              await NoteFactory.createForPlaceholderWikilink(title, target);
              return;
          }
        }
      )
    );
  },
};

export default feature;
