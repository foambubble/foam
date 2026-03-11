import * as vscode from 'vscode';
import { Foam } from '../core/model/foam';
import { MarkdownLink } from '../core/services/markdown-link';
import { Logger } from '../core/utils/log';
import { getFoamVsCodeConfig } from '../services/config';
import { fromVsCodeUri, toVsCodeRange, toVsCodeUri } from '../utils/vsc-utils';
import { URI } from '../core/model/uri';
import { Resource } from '../core/model/note';
import { WorkspaceTextEdit } from '../core/services/text-edit';
import { FoamWorkspace } from '../core/model/workspace';

const MARKDOWN_LINK_NOTIFICATION_KEY =
  'foam.links.sync.markdownLinkNotificationShown';

/**
 * Builds a future-state workspace reflecting the given renames.
 * Old URIs are removed and new URIs are added, so that getIdentifier correctly
 * disambiguates renamed files against each other and against the rest of the workspace.
 */
function buildFutureWorkspace(
  workspace: FoamWorkspace,
  renames: Array<{ oldResource: Resource; newUri: URI }>
): FoamWorkspace {
  const future = new FoamWorkspace(workspace.roots, workspace.defaultExtension);
  for (const resource of workspace.list()) {
    future.set(resource);
  }
  for (const { oldResource, newUri } of renames) {
    future.delete(oldResource.uri);
    future.set({ ...oldResource, uri: newUri });
  }
  return future;
}

/**
 * `getDirectoryIdentifier` normalizes paths to lowercase for case-insensitive
 * matching, so its return value is always lowercase. This helper restores
 * the correct casing by matching the identifier's segments against the actual
 * path segments of the directory URI.
 *
 * Example: lowerId='folderb', dirPath='/folderB' → 'folderB'
 * Example: lowerId='parent/folderb', dirPath='/parent/folderB' → 'parent/folderB'
 */
function toCorrectCase(lowerId: string, dirUri: URI): string {
  const idSegments = lowerId.split('/');
  const pathSegments = dirUri.path.split('/').filter(Boolean);
  return pathSegments.slice(-idSegments.length).join('/');
}

/**
 * Core computation: given a list of (oldResource → newUri) pairs, computes
 * all wikilink edits needed in files that link to those resources.
 *
 * Uses a future-state workspace for identifier computation, so that:
 * - Files being renamed don't compete with their own old paths.
 * - Files within the same batch (e.g. a directory rename) correctly disambiguate
 *   against each other in the post-rename state.
 * - Directory-style identifiers (e.g. [[folderA]] → [[folderB]]) are preserved.
 */
function computeRenameEditsForPairs(
  foam: Foam,
  renames: Array<{ oldResource: Resource; newUri: URI }>
): WorkspaceTextEdit[] {
  if (renames.length === 0) {
    return [];
  }

  const futureWorkspace = buildFutureWorkspace(foam.workspace, renames);
  const allEdits: WorkspaceTextEdit[] = [];

  for (const { oldResource, newUri } of renames) {
    const connections = foam.graph.getBacklinks(oldResource.uri);
    // getDirectoryIdentifier normalizes to lowercase; comparison must be case-insensitive
    const oldDirIdentifier = foam.workspace.getDirectoryIdentifier(
      oldResource.uri
    );

    for (const connection of connections) {
      if (connection.link.type !== 'wikilink') {
        continue;
      }
      const { target: linkTarget } = MarkdownLink.analyzeLink(connection.link);
      let identifier: string;
      if (
        oldDirIdentifier &&
        linkTarget.toLocaleLowerCase() === oldDirIdentifier
      ) {
        // Link uses a directory-style identifier (e.g. [[folderA]]). Compute the
        // new directory identifier and restore its correct casing from the URI.
        const newDirUri = newUri.getDirectory();
        const lowerId = futureWorkspace.getDirectoryIdentifier(newUri);
        identifier = lowerId
          ? toCorrectCase(lowerId, newDirUri)
          : futureWorkspace.getIdentifier(newUri);
      } else {
        identifier = futureWorkspace.getIdentifier(newUri);
      }

      const edit = MarkdownLink.createUpdateLinkEdit(connection.link, {
        target: identifier,
      });
      allEdits.push({ uri: connection.source, edit });
    }
  }

  return allEdits;
}

export function computeWikilinkRenameEdits(
  foam: Foam,
  oldUri: URI,
  newUri: URI
): WorkspaceTextEdit[] {
  const oldResource = foam.workspace.find(oldUri);
  if (!oldResource) {
    return [];
  }
  return computeRenameEditsForPairs(foam, [{ oldResource, newUri }]);
}

export function computeDirectoryWikilinkRenameEdits(
  foam: Foam,
  oldDirUri: URI,
  newDirUri: URI
): WorkspaceTextEdit[] {
  const oldDirPath = oldDirUri.path;
  const renames = foam.workspace
    .list()
    .filter(r => r.uri.path.startsWith(oldDirPath + '/'))
    .map(r => ({
      oldResource: r,
      newUri: newDirUri.joinPath(r.uri.path.slice(oldDirPath.length + 1)),
    }));
  return computeRenameEditsForPairs(foam, renames);
}

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
          ? computeDirectoryWikilinkRenameEdits(foam, foamOldUri, foamNewUri)
          : computeWikilinkRenameEdits(foam, foamOldUri, foamNewUri);

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
