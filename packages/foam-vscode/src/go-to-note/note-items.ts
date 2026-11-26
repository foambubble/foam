import {
  FoamWorkspace,
  URI,
  getRootUriFor,
  uriToWorkspacePath,
} from '@foam/core';
import { NoteRecency } from './note-recency';

export interface NoteItem {
  label: string;
  description: string;
  detail?: string;
  uri: URI;
}

/**
 * One item per note, the most recently visited first, then the rest by title.
 * The title is the label, the workspace-relative path the description, and
 * the aliases, if any, the detail. With more than one root, the path starts
 * with the name of the root folder the note is in.
 */
export function createNoteItems(
  workspace: FoamWorkspace,
  recency: NoteRecency
): NoteItem[] {
  const describe = (uri: URI) => {
    const path = uriToWorkspacePath(uri, workspace);
    return workspace.roots.length > 1
      ? `${getRootUriFor(workspace, uri).getBasename()}/${path}`
      : path;
  };
  return workspace
    .list()
    .filter(resource => resource.type === 'note')
    .map(resource => ({
      label: resource.title,
      description: describe(resource.uri),
      detail:
        resource.aliases.length > 0
          ? `Alias: ${resource.aliases.map(alias => alias.title).join(', ')}`
          : undefined,
      uri: resource.uri,
    }))
    .sort(
      (a, b) =>
        recency.rank(a.uri) - recency.rank(b.uri) ||
        a.label.localeCompare(b.label)
    );
}
