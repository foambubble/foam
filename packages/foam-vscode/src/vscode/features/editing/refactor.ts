import * as vscode from 'vscode';
import {
  computeDirectoryWikilinkRenameEdits,
  computeWikilinkRenameEdits,
  Foam,
  listDirectoryRenamePairs,
  Logger,
  type URI,
} from '@foam/core';
import { getFoamVsCodeConfig } from '../../config';
import {
  fromVsCodeUri,
  toVsCodeRange,
  toVsCodeUri,
} from '../../utils/vsc-utils';

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

  /**
   * Rewrites the wikilinks that point at what is being renamed, and records
   * what a directory rename is about to move.
   *
   * Registered through `waitUntil`: VS Code does not await a listener's own
   * promise, so otherwise this would not finish before the rename lands.
   */
  const syncBeforeRename = async (e: vscode.FileWillRenameEvent) => {
    const syncLinks = getFoamVsCodeConfig<boolean>('links.sync.enable', true);
    // Anything still pending belongs to an earlier rename that was cancelled
    // before it completed, so it can never be consumed.
    pendingDirectoryRenames.clear();
    const directoryRenames: Array<{ key: string; oldUri: URI; newUri: URI }> =
      [];
    const renameEdits = new vscode.WorkspaceEdit();
    let hasMarkdownBacklinks = false;
    for (const { oldUri, newUri } of e.files) {
      const foamOldUri = fromVsCodeUri(oldUri);
      const foamNewUri = fromVsCodeUri(newUri);

      // As for deletes, VS Code can announce a rename for a path Foam cannot
      // stat; there is nothing to rewrite or move in that case.
      let stat: vscode.FileStat;
      try {
        stat = await vscode.workspace.fs.stat(oldUri);
      } catch {
        continue;
      }
      const isDirectory = stat.type === vscode.FileType.Directory;

      // Noted before the links.sync check: rewriting links is optional,
      // keeping the workspace index consistent is not.
      if (isDirectory) {
        directoryRenames.push({
          key: oldUri.toString(),
          oldUri: foamOldUri,
          newUri: foamNewUri,
        });
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
          await editor.save();
          // Re-index what we just rewrote: the watcher is scoped to note
          // extensions and may not report these files.
          await foam.workspace.fetchAndSet(fromVsCodeUri(uri));
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

    // Listed after the rewrite, not before: the rewrite re-indexes every file
    // whose links it changed, and a note inside the directory being renamed can
    // be one of them. Pairs collected earlier would carry a pre-rewrite copy of
    // that note back into the index once the rename lands.
    for (const { key, oldUri, newUri } of directoryRenames) {
      pendingDirectoryRenames.set(
        key,
        listDirectoryRenamePairs(foam.workspace, oldUri, newUri)
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
  };

  /**
   * Drops the notes under a directory that is about to be deleted. The watcher
   * is scoped to note extensions, so it never sees the directory go, and on
   * macOS and Linux it receives no per-file event either.
   *
   * Registered through `waitUntil` for the same reason as the rename above.
   */
  const cleanUpBeforeDelete = async (e: vscode.FileWillDeleteEvent) => {
    for (const uri of e.files) {
      // VS Code also announces a delete for a path that is already gone.
      let stat: vscode.FileStat;
      try {
        stat = await vscode.workspace.fs.stat(uri);
      } catch {
        continue;
      }
      if (stat.type !== vscode.FileType.Directory) {
        continue;
      }
      const foamUri = fromVsCodeUri(uri);
      foam.workspace
        .list()
        .filter(r => r.uri.path.startsWith(foamUri.path + '/'))
        .forEach(resource => foam.workspace.delete(resource.uri));
    }
  };

  context.subscriptions.push(
    vscode.workspace.onWillRenameFiles(e => e.waitUntil(syncBeforeRename(e))),

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
    vscode.workspace.onDidRenameFiles(e => {
      for (const { oldUri } of e.files) {
        const pairs = pendingDirectoryRenames.get(oldUri.toString());
        if (!pairs) {
          continue;
        }
        pendingDirectoryRenames.delete(oldUri.toString());
        for (const { oldResource, newUri } of pairs) {
          // A directory move leaves the contents, and so the parsed resource,
          // untouched. Re-reading from disk is async, and awaiting it here
          // leaves a window in which the note is indexed under neither path.
          foam.workspace.delete(oldResource.uri);
          foam.workspace.set({ ...oldResource, uri: newUri });
        }
      }
    }),

    vscode.workspace.onWillDeleteFiles(e => e.waitUntil(cleanUpBeforeDelete(e)))
  );
}
