import * as vscode from 'vscode';
import { Foam } from '@foam/core';
import { Logger } from '@foam/core';
import { getFoamVsCodeConfig } from '../../config';
import {
  fromVsCodeUri,
  toVsCodeRange,
  toVsCodeUri,
} from '../../utils/vsc-utils';
import {
  computeWikilinkRenameEdits,
  computeDirectoryWikilinkRenameEdits,
  listDirectoryRenamePairs,
} from '@foam/core';

const MARKDOWN_LINK_NOTIFICATION_KEY =
  'foam.links.sync.markdownLinkNotificationShown';

export default async function activate(
  context: vscode.ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const foam = await foamPromise;

  /**
   * Resources that a directory rename is about to move, collected while the old
   * paths are still indexed and consumed once the rename has happened. Keyed by
   * the old directory URI.
   */
  const pendingDirectoryRenames = new Map<
    string,
    ReturnType<typeof listDirectoryRenamePairs>
  >();

  context.subscriptions.push(
    vscode.workspace.onWillRenameFiles(async e => {
      const syncLinks = getFoamVsCodeConfig<boolean>('links.sync.enable', true);
      // Anything still pending belongs to an earlier rename that was cancelled
      // before it completed, so it can never be consumed.
      pendingDirectoryRenames.clear();
      const renameEdits = new vscode.WorkspaceEdit();
      let hasMarkdownBacklinks = false;
      for (const { oldUri, newUri } of e.files) {
        const foamOldUri = fromVsCodeUri(oldUri);
        const foamNewUri = fromVsCodeUri(newUri);

        const isDirectory =
          (await vscode.workspace.fs.stat(oldUri)).type ===
          vscode.FileType.Directory;

        // Collected before the links.sync check: rewriting links is optional,
        // keeping the workspace index consistent is not.
        if (isDirectory) {
          pendingDirectoryRenames.set(
            oldUri.toString(),
            listDirectoryRenamePairs(foam.workspace, foamOldUri, foamNewUri)
          );
        }

        if (!syncLinks) {
          continue;
        }

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

      if (!syncLinks) {
        return;
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
        void context.globalState.update(MARKDOWN_LINK_NOTIFICATION_KEY, true);
        if (vsCodeMarkdownSetting === 'never') {
          void vscode.window
            .showInformationMessage(
              "Foam updated your wikilinks. To also update standard markdown links on rename, enable VS Code's built-in setting.",
              'Enable',
              'Dismiss'
            )
            .then(choice => {
              if (choice === 'Enable') {
                return vscode.workspace
                  .getConfiguration('markdown')
                  .update(
                    'updateLinksOnFileMove.enabled',
                    'always',
                    vscode.ConfigurationTarget.Global
                  );
              }
            });
        }
      }
    }),

    /**
     * Completes a directory rename: the entries collected before the move are
     * removed from their old paths and re-indexed under the new ones.
     *
     * Foam cannot rely on file watcher events here. The watcher is scoped to
     * note and attachment extensions, and a directory rename is reported at
     * directory granularity on several platforms, so the per-file creates that
     * would otherwise re-index these files may never arrive. Doing it here
     * makes the rename self-contained and platform-independent (issue #1696).
     */
    vscode.workspace.onDidRenameFiles(async e => {
      for (const { oldUri } of e.files) {
        const pairs = pendingDirectoryRenames.get(oldUri.toString());
        if (!pairs) {
          continue;
        }
        pendingDirectoryRenames.delete(oldUri.toString());
        for (const { oldResource, newUri } of pairs) {
          foam.workspace.delete(oldResource.uri);
          await foam.workspace.fetchAndSet(newUri);
        }
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
