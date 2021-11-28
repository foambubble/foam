import * as vscode from 'vscode';
import { FoamFeature } from '../types';
import { URI } from '../core/model/uri';
import { fromVsCodeUri, toVsCodeRange, toVsCodeUri } from '../utils/vsc-utils';
import { NoteFactory } from '../services/templates';
import { Foam } from '../core/model/foam';

export const OPEN_COMMAND = {
  command: 'foam-vscode.open-resource',
  title: 'Foam: Open Resource',

  asURI: (uri: URI) =>
    vscode.Uri.parse(`command:${OPEN_COMMAND.command}`).with({
      query: encodeURIComponent(JSON.stringify({ uri: URI.create(uri) })),
    }),
};

const feature: FoamFeature = {
  activate: (context: vscode.ExtensionContext, foamPromise: Promise<Foam>) => {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        OPEN_COMMAND.command,
        async (params: { uri: URI }) => {
          const { uri } = params;
          switch (uri.scheme) {
            case 'file':
              let selection = new vscode.Range(1, 0, 1, 0);
              if (uri.fragment) {
                const foam = await foamPromise;
                const resource = foam.workspace.get(uri);
                const block = resource.blocks.find(
                  b => b.label === uri.fragment
                );
                if (block) {
                  selection = toVsCodeRange(block.range);
                }
              }
              return vscode.commands.executeCommand(
                'vscode.open',
                toVsCodeUri(uri),
                {
                  selection: selection,
                }
              );

            case 'placeholder':
              const title = uri.path.split('/').slice(-1)[0];

              const basedir =
                vscode.workspace.workspaceFolders.length > 0
                  ? fromVsCodeUri(vscode.workspace.workspaceFolders[0].uri)
                  : fromVsCodeUri(vscode.window.activeTextEditor?.document.uri)
                  ? URI.getDir(
                      fromVsCodeUri(
                        vscode.window.activeTextEditor!.document.uri
                      )
                    )
                  : undefined;

              if (basedir === undefined) {
                return;
              }

              const target = URI.createResourceUriFromPlaceholder(basedir, uri);

              await NoteFactory.createForPlaceholderWikilink(title, target);
              return;
          }
        }
      )
    );
  },
};

export default feature;
