import * as vscode from 'vscode';
import { Foam } from '../core/model/foam';
import { MarkdownLink } from '../core/services/markdown-link';
import { Logger } from '../core/utils/log';
import { getFoamVsCodeConfig } from '../services/config';
import { fromVsCodeUri, toVsCodeRange, toVsCodeUri } from '../utils/vsc-utils';

const MARKDOWN_LINK_NOTIFICATION_KEY =
  'foam.links.sync.markdownLinkNotificationShown';

export default async function activate(
  context: vscode.ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const foam = await foamPromise;

  context.subscriptions.push(
    vscode.workspace.onWillRenameFiles(async e => {
      if (!getFoamVsCodeConfig<boolean>('links.sync.enable')) {
        return;
      }
      const renameEdits = new vscode.WorkspaceEdit();
      let hasMarkdownBacklinks = false;
      for (const { oldUri, newUri } of e.files) {
        if (
          (await vscode.workspace.fs.stat(oldUri)).type ===
          vscode.FileType.Directory
        ) {
          vscode.window.showWarningMessage(
            'Foam: Updating links on directory rename is not supported.'
          );
          continue;
        }
        const connections = foam.graph.getBacklinks(fromVsCodeUri(oldUri));
        for (const connection of connections) {
          switch (connection.link.type) {
            case 'wikilink': {
              const identifier = foam.workspace.getIdentifier(
                fromVsCodeUri(newUri),
                [fromVsCodeUri(oldUri)]
              );
              const edit = MarkdownLink.createUpdateLinkEdit(connection.link, {
                target: identifier,
              });
              renameEdits.replace(
                toVsCodeUri(connection.source),
                toVsCodeRange(edit.range),
                edit.newText
              );
              break;
            }
            case 'link': {
              hasMarkdownBacklinks = true;
              break;
            }
          }
        }
      }

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

      // On the first rename where there are markdown backlinks, nudge the user
      // to enable VS Code's built-in markdown link update setting if they haven't already.
      if (
        hasMarkdownBacklinks &&
        !context.globalState.get(MARKDOWN_LINK_NOTIFICATION_KEY)
      ) {
        const vsCodeMarkdownSetting = vscode.workspace
          .getConfiguration('markdown')
          .get<string>('updateLinksOnFileMove.enabled', 'never');
        if (vsCodeMarkdownSetting === 'never') {
          const choice = await vscode.window.showInformationMessage(
            "Foam updated your wikilinks. To also update standard markdown links on rename, enable VS Code's built-in setting.",
            'Enable',
            'Dismiss'
          );
          if (choice === 'Enable') {
            await vscode.workspace
              .getConfiguration('markdown')
              .update(
                'updateLinksOnFileMove.enabled',
                'always',
                vscode.ConfigurationTarget.Global
              );
          }
        }
        await context.globalState.update(MARKDOWN_LINK_NOTIFICATION_KEY, true);
      }
    })
  );
}
