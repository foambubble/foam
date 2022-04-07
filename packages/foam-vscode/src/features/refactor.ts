import * as vscode from 'vscode';
import { Foam } from '../core/model/foam';
import { MarkdownLink } from '../core/services/markdown-link';
import { Logger } from '../core/utils/log';
import { isAbsolute } from '../core/utils/path';
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
        if (!getFoamVsCodeConfig<boolean>('links.sync.enable')) {
          return;
        }
        e.files.forEach(({ oldUri, newUri }) => {
          const connections = foam.graph.getBacklinks(fromVsCodeUri(oldUri));
          connections.forEach(async connection => {
            const { target } = MarkdownLink.analyzeLink(connection.link);
            switch (connection.link.type) {
              case 'wikilink': {
                const identifier = foam.workspace.getIdentifier(
                  fromVsCodeUri(newUri)
                );
                const edit = MarkdownLink.createUpdateLinkEdit(
                  connection.link,
                  { target: identifier }
                );
                originatingFileEdit.replace(
                  toVsCodeUri(connection.source),
                  toVsCodeRange(edit.selection),
                  edit.newText
                );
                break;
              }
              case 'link': {
                const path = isAbsolute(target)
                  ? '/' + vscode.workspace.asRelativePath(newUri)
                  : fromVsCodeUri(newUri).relativeTo(
                      connection.source.getDirectory()
                    ).path;
                const edit = MarkdownLink.createUpdateLinkEdit(
                  connection.link,
                  { target: path }
                );
                originatingFileEdit.replace(
                  toVsCodeUri(connection.source),
                  toVsCodeRange(edit.selection),
                  edit.newText
                );
                break;
              }
            }
          });
        });
        try {
          await vscode.workspace.applyEdit(originatingFileEdit);
          await vscode.commands.executeCommand(
            'workbench.action.files.saveAll'
          );
          await vscode.workspace.saveAll();

          // Reporting
          const nUpdates = originatingFileEdit
            .entries()
            .reduce((acc, entry) => {
              return (acc += entry[1].length);
            }, 0);
          const links = nUpdates > 1 ? 'links' : 'link';
          const nFiles = originatingFileEdit.entries().length;
          const files = nFiles > 1 ? 'files' : 'file';
          vscode.window.showInformationMessage(
            `Foam updated ${nUpdates} ${links} across ${nFiles} ${files}.`
          );
        } catch (e) {
          Logger.error('Error while updating references to file', e);
          vscode.window.showErrorMessage(
            `Foam couldn't update the links to ${vscode.workspace.asRelativePath(
              e.newUri
            )}. Check the logs for error details.`
          );
        }
      })
    );
  },
};
export default feature;
