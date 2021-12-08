import * as vscode from 'vscode';
import { Foam } from '../core/model/foam';
import { URI } from '../core/model/uri';
import { replaceSelection } from '../services/editor';
import { FoamFeature } from '../types';
import { fromVsCodeUri, toVsCodeRange, toVsCodeUri } from '../utils/vsc-utils';

const feature: FoamFeature = {
  activate: async (
    context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {
    const foam = await foamPromise;

    context.subscriptions.push(
      vscode.workspace.onWillRenameFiles(async e => {
        const originatingFileEdit = new vscode.WorkspaceEdit();
        e.files.forEach(({ oldUri, newUri }) => {
          const identifier = foam.workspace.getIdentifier(
            fromVsCodeUri(newUri)
          );
          const connections = foam.graph.getBacklinks(fromVsCodeUri(oldUri));
          connections.forEach(async connection => {
            const range = toVsCodeRange(connection.link.range);
            switch (connection.link.type) {
              case 'wikilink':
                originatingFileEdit.replace(
                  toVsCodeUri(connection.source),
                  new vscode.Selection(
                    range.start.line,
                    range.start.character + 2,
                    range.end.line,
                    range.end.character - 2
                  ),
                  identifier
                );
                break;
              case 'link':
                const path = connection.link.target.startsWith('/') // TODO replace with isAbsolute after path refactoring
                  ? '/' + vscode.workspace.asRelativePath(newUri)
                  : URI.relativePath(connection.source, fromVsCodeUri(newUri));
                originatingFileEdit.replace(
                  toVsCodeUri(connection.source),
                  new vscode.Selection(
                    range.start.line,
                    range.start.character + 2 + connection.link.label.length,
                    range.end.line,
                    range.end.character
                  ),
                  '(' + path + ')'
                );
                break;
            }
          });
        });
        return await vscode.workspace.applyEdit(originatingFileEdit);
      })
    );
  },
};
export default feature;
