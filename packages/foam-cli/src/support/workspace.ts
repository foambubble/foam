import path from 'node:path';
import { FoamWorkspace, URI } from '@foam/core';

/**
 * Returns the workspace-relative path for a URI.
 */
export function uriToWorkspacePath(uri: URI, rootDir: string): string {
  return path.relative(rootDir, uri.toFsPath());
}

/**
 * Resolves a note by identifier or --path flag.
 * Errors with a helpful message if the identifier is ambiguous.
 */
export function resolveNote(
  workspace: InstanceType<typeof FoamWorkspace>,
  identifier: string | undefined,
  pathFlag: string | undefined
) {
  if (pathFlag) {
    const uri = URI.file(path.resolve(pathFlag));
    const resource = workspace.find(uri);
    if (!resource) {
      throw new Error(`Note not found at path: ${pathFlag}`);
    }
    return resource;
  }

  if (!identifier) {
    throw new Error('Provide a note identifier or --path <path>.');
  }

  const candidates = workspace.listByIdentifier(identifier);
  if (candidates.length === 0) {
    throw new Error(`Note not found: "${identifier}"`);
  }
  if (candidates.length > 1) {
    const paths = candidates.map(r => r.uri.toFsPath()).join('\n  ');
    throw new Error(
      `Ambiguous identifier "${identifier}". Candidates:\n  ${paths}\n\nUse --path <path> to select one.`
    );
  }
  return candidates[0];
}
