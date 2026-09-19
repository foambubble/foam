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

  /**
   * Rewrites the wikilinks that point at what is being renamed, and records
   * what a directory rename is about to move.
   *
   * Registered through `waitUntil` so that the rename waits for it. VS Code
   * does not await a listener's own promise, so without it the rename lands
   * first and this work races whatever the user does next — renaming the same
   * folder twice in a row would compute the second set of edits from links
   * that had not been re-indexed yet.
   */
  const syncBeforeRename = async (e: vscode.FileWillRenameEvent) => {
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
          await editor.save();
          // Re-index the file we just rewrote. The watcher is debounced and,
          // for the files a directory rename touches, may not fire at all
          // (issue #1696), so the in-memory resource would keep the old link
          // text — and a second rename of the same folder would then find no
          // backlinks left to update.
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
   * Drops the notes under a directory that is about to be deleted.
   *
   * On platforms where the file watcher fires directory-level events (e.g.
   * macOS FSEvents, Linux inotify), Foam never receives individual delete
   * events for the files inside a deleted directory, and the watcher is scoped
   * to note extensions so it never sees the directory itself. The delete events
   * fired here let downstream clients (graph, tags, etc.) update their state.
   *
   * Registered through `waitUntil` so the delete waits for it, which is what
   * makes the workspace consistent by the time the delete is observable.
   */
  const cleanUpBeforeDelete = async (e: vscode.FileWillDeleteEvent) => {
    for (const uri of e.files) {
      // VS Code also announces a delete for a path that is already gone (an
      // `ignoreIfNotExists` edit, or a racing delete). Statting it throws, and
      // an unhandled rejection here takes the extension host down with it.
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
          // Re-keyed rather than re-read from disk: a directory move leaves the
          // file contents, and so the parsed resource, untouched — only the URI
          // changes, and the basename (which a title can fall back to) moves
          // with it. Re-reading would be async, and awaiting it here leaves a
          // window in which the note is under neither path — which is the way
          // notes went missing from the index in the first place (issue #1699).
          foam.workspace.delete(oldResource.uri);
          foam.workspace.set({ ...oldResource, uri: newUri });
        }
      }
    }),

    vscode.workspace.onWillDeleteFiles(e => e.waitUntil(cleanUpBeforeDelete(e)))
  );
}
