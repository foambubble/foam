import * as vscode from 'vscode';
import { Foam } from '../core/model/foam';
import { MarkdownLink } from '../core/services/markdown-link';
import { Logger } from '../core/utils/log';
import { isAbsolute } from '../core/utils/path';
import { getFoamVsCodeConfig } from '../services/config';
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
        if (!getFoamVsCodeConfig<boolean>('links.sync.enable')) {
          return;
        }
        const renameEdits = new vscode.WorkspaceEdit();
        e.files.forEach(({ oldUri, newUri }) => {
          const connections = foam.graph.getBacklinks(fromVsCodeUri(oldUri));
          connections.forEach(async connection => {
            const { target } = MarkdownLink.analyzeLink(connection.link);
            switch (connection.link.type) {
              case 'wikilink': {
                const identifier = foam.workspace.getIdentifier(
                  fromVsCodeUri(newUri),
                  [fromVsCodeUri(oldUri)]
                );
                const edit = MarkdownLink.createUpdateLinkEdit(
                  connection.link,
                  { target: identifier }
                );
                renameEdits.replace(
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
                renameEdits.replace(
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
          if (renameEdits.size > 0) {
            // We break the update by file because applying it at once was causing
            // dirty state and editors not always saving or closing
            for (const renameEditForUri of renameEdits.entries()) {
              const [uri, edits] = renameEditForUri;
              const fileEdits = new vscode.WorkspaceEdit();
              fileEdits.set(uri, edits);
              await vscode.workspace.applyEdit(fileEdits);
              const editor = await vscode.workspace.openTextDocument(uri);
              // Because the save happens within 50ms of opening the doc, it will be then closed
              editor.save();
            }

            // Reporting
            const nUpdates = renameEdits.entries().reduce((acc, entry) => {
              return (acc += entry[1].length);
            }, 0);
            const links = nUpdates > 1 ? 'links' : 'link';
            const nFiles = renameEdits.size;
            const files = nFiles > 1 ? 'files' : 'file';
            Logger.info(
              `Updated links in the following files:`,
              ...renameEdits
                .entries()
                .map(e => vscode.workspace.asRelativePath(e[0]))
            );
            vscode.window.showInformationMessage(
              `Updated ${nUpdates} ${links} across ${nFiles} ${files}.`
            );
          }
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
