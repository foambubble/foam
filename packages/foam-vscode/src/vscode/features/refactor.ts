import * as vscode from 'vscode';
import { Foam } from '../../core/model/foam';
import { Logger } from '../../core/utils/log';
import { getFoamVsCodeConfig } from '../../services/config';
import {
  fromVsCodeUri,
  toVsCodeRange,
  toVsCodeUri,
} from '../../utils/vsc-utils';
import {
  computeWikilinkRenameEdits,
  computeDirectoryWikilinkRenameEdits,
} from '../../core/services/link-integrity';

const MARKDOWN_LINK_NOTIFICATION_KEY =
  'foam.links.sync.markdownLinkNotificationShown';

export default async function activate(
  context: vscode.ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const foam = await foamPromise;

  context.subscriptions.push(
    vscode.workspace.onWillRenameFiles(async e => {
      if (!getFoamVsCodeConfig<boolean>('links.sync.enable', true)) {
        return;
      }
      const renameEdits = new vscode.WorkspaceEdit();
      let hasMarkdownBacklinks = false;
      for (const { oldUri, newUri } of e.files) {
        const foamOldUri = fromVsCodeUri(oldUri);
        const foamNewUri = fromVsCodeUri(newUri);

        const isDirectory =
          (await vscode.workspace.fs.stat(oldUri)).type ===
          vscode.FileType.Directory;

        const wikilinkEdits = isDirectory
          ? computeDirectoryWikilinkRenameEdits(
              foam.workspace,
              foam.graph,
              foamOldUri,
              foamNewUri
            )
          : computeWikilinkRenameEdits(
              foam.workspace,
              foam.graph,
              foamOldUri,
              foamNewUri
            );

        for (const { uri, edit } of wikilinkEdits) {
          renameEdits.replace(
            toVsCodeUri(uri),
            toVsCodeRange(edit.range),
            edit.newText
          );
        }

        // For directory renames, remove stale workspace entries for files under
        // the old directory path. On macOS (FSEvents), the file watcher fires
        // directory-level events rather than per-file events, so Foam never
        // receives individual delete events for those files. We clean up here,
        // synchronously, inside the awaited onWillRenameFiles handler, before
        // VS Code performs the actual rename.
        if (isDirectory) {
          const oldDirPath = foamOldUri.path;
          foam.workspace
            .list()
            .filter(r => r.uri.path.startsWith(oldDirPath + '/'))
            .forEach(resource => foam.workspace.delete(resource.uri));
        }

        if (!isDirectory) {
          if (
            foam.graph
              .getBacklinks(foamOldUri)
              .some(c => c.link.type === 'link')
          ) {
            hasMarkdownBacklinks = true;
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
    }),

    vscode.workspace.onWillDeleteFiles(async e => {
      for (const uri of e.files) {
        const stat = await vscode.workspace.fs.stat(uri);
        if (stat.type !== vscode.FileType.Directory) {
          continue;
        }
        // On platforms where the file watcher fires directory-level events
        // (e.g. macOS FSEvents, Linux inotify), Foam never receives individual
        // delete events for files inside a deleted directory. We clean up here,
        // synchronously, inside the awaited onWillDeleteFiles handler, so that
        // the workspace stays consistent. The delete events fired here allow
        // downstream clients (graph, tags, etc.) to update their state.
        const foamUri = fromVsCodeUri(uri);
        foam.workspace
          .list()
          .filter(r => r.uri.path.startsWith(foamUri.path + '/'))
          .forEach(resource => foam.workspace.delete(resource.uri));
      }
    })
  );
}
