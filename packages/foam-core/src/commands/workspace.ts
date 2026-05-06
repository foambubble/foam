import { FoamWorkspace } from '../model/workspace';
import { Resource } from '../model/note';
import { URI } from '../model/uri';
import { FoamError } from '../common/errors';
import { isWithinPath, relativeTo } from '../utils/path';

/**
 * A reference to a note. Either the URI is known (the caller resolved a
 * path themselves) or a short Foam identifier is given and the workspace
 * resolves it through its identifier index.
 *
 * Callers (CLI / MCP / VS Code) translate their own inputs (CLI flags,
 * MCP tool args, editor selection) into this shape.
 */
export type NoteRef = { uri: URI } | { identifier: string };

/**
 * Returns the workspace root URI that contains the given URI, or
 * `workspace.roots[0]` as a fallback when nothing matches (e.g. when the
 * URI is a placeholder or lives outside the workspace).
 *
 * Useful when a command needs to compute a resource-relative path: in a
 * multi-root workspace, the correct base depends on which root the
 * resource lives in.
 */
export function getRootUriFor(
  workspace: FoamWorkspace,
  uri: URI
): URI {
  const containing = workspace.roots.find(root => isWithinPath(uri, root));
  return containing ?? workspace.roots[0];
}

/**
 * Returns the workspace-relative POSIX path for a URI.
 *
 * The base is the workspace root that contains the URI (or `roots[0]`
 * as a fallback). This makes the function safe to use in multi-root
 * workspaces without the caller having to figure out which root to use.
 *
 * Works on POSIX URI paths regardless of platform.
 */
export function uriToWorkspacePath(
  uri: URI,
  workspace: FoamWorkspace
): string {
  const root = getRootUriFor(workspace, uri);
  return relativeTo(uri.path, root.path);
}

/**
 * Resolves a {@link NoteRef} to a {@link Resource}.
 *
 * Throws {@link FoamError} with code:
 * - `resource_not_found` when no note matches
 * - `ambiguous_identifier` when the identifier matches multiple notes
 */
export function resolveNote(
  workspace: FoamWorkspace,
  ref: NoteRef
): Resource {
  if ('uri' in ref) {
    const resource = workspace.find(ref.uri);
    if (!resource) {
      throw new FoamError(
        'resource_not_found',
        `Note not found at path: ${ref.uri.toFsPath()}`,
        { uri: ref.uri.toFsPath() }
      );
    }
    return resource;
  }

  const candidates = workspace.listByIdentifier(ref.identifier);
  if (candidates.length === 0) {
    throw new FoamError(
      'resource_not_found',
      `Note not found: "${ref.identifier}"`,
      { identifier: ref.identifier }
    );
  }
  if (candidates.length > 1) {
    const paths = candidates.map(r => r.uri.toFsPath()).join('\n  ');
    throw new FoamError(
      'ambiguous_identifier',
      `Ambiguous identifier "${ref.identifier}". Candidates:\n  ${paths}`,
      {
        identifier: ref.identifier,
        candidates: candidates.map(r => r.uri.toFsPath()),
      }
    );
  }
  return candidates[0];
}
