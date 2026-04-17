import { FoamGraph } from '../model/graph';
import { Resource } from '../model/note';
import { URI } from '../model/uri';
import { FoamWorkspace } from '../model/workspace';
import { MarkdownLink } from './markdown-link';
import { WorkspaceTextEdit } from './text-edit';

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
  workspace: FoamWorkspace,
  graph: FoamGraph,
  renames: Array<{ oldResource: Resource; newUri: URI }>
): WorkspaceTextEdit[] {
  if (renames.length === 0) {
    return [];
  }

  const futureWorkspace = buildFutureWorkspace(workspace, renames);
  const allEdits: WorkspaceTextEdit[] = [];

  for (const { oldResource, newUri } of renames) {
    const connections = graph.getBacklinks(oldResource.uri);
    // getDirectoryIdentifier normalizes to lowercase; comparison must be case-insensitive
    const oldDirIdentifier = workspace.getDirectoryIdentifier(oldResource.uri);

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
  workspace: FoamWorkspace,
  graph: FoamGraph,
  oldUri: URI,
  newUri: URI
): WorkspaceTextEdit[] {
  const oldResource = workspace.find(oldUri);
  if (!oldResource) {
    return [];
  }
  return computeRenameEditsForPairs(workspace, graph, [
    { oldResource, newUri },
  ]);
}

export function computeDirectoryWikilinkRenameEdits(
  workspace: FoamWorkspace,
  graph: FoamGraph,
  oldDirUri: URI,
  newDirUri: URI
): WorkspaceTextEdit[] {
  const oldDirPath = oldDirUri.path;
  const renames = workspace
    .list()
    .filter(r => r.uri.path.startsWith(oldDirPath + '/'))
    .map(r => ({
      oldResource: r,
      newUri: newDirUri.joinPath(r.uri.path.slice(oldDirPath.length + 1)),
    }));
  return computeRenameEditsForPairs(workspace, graph, renames);
}
