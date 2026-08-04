import {
  TextEdit,
  WorkspaceTextEdit,
} from '../services/text-edit';
import { computeWikilinkRenameEdits } from '../services/link-integrity';
import { FoamGraph } from '../model/graph';
import { Resource } from '../model/note';
import { FoamWorkspace } from '../model/workspace';
import { URI } from '../model/uri';
import { IDataStore } from '../services/datastore';
import { FoamError } from '../common/errors';
import { relativeTo } from '../utils/path';
import { getRootUriFor } from './workspace';

// ─── Return types ─────────────────────────────────────────────────────────────

export interface NoteDetail {
  id: string;
  uri: URI;
  title: string;
  type: string;
  tags: string[];
  aliases: string[];
  properties: Record<string, unknown>;
  links?: { outgoing: string[]; incoming: string[] };
}

export interface NoteIdResult {
  id: string;
  uri: URI;
}

export interface NoteMoveResult {
  old_uri: URI;
  new_uri: URI;
  old_id: string;
  id: string;
  updated_links: number;
}

export interface NoteDeleteResult {
  /** Final location of the file after the operation: `.foam/trash/...` URI when trashed, or the original URI when permanently deleted. */
  uri: URI;
  /** Original URI of the deleted resource. */
  source_uri: URI;
  /** True if the file was moved to trash, false if permanently deleted. */
  trashed: boolean;
}

// ─── Read: show ───────────────────────────────────────────────────────────────

export function noteShowData(
  workspace: FoamWorkspace,
  graph: FoamGraph,
  resource: Resource,
  opts: { includeLinks?: boolean }
): NoteDetail {
  const id = workspace.getIdentifier(resource.uri);

  const base: NoteDetail = {
    id,
    uri: resource.uri,
    title: resource.title,
    type: resource.type,
    tags: resource.tags.map(t => t.label),
    aliases: resource.aliases.map(a => a.title),
    properties: resource.properties as Record<string, unknown>,
  };

  if (!opts.includeLinks) {
    return base;
  }

  const outgoing = graph
    .getLinks(resource.uri)
    .map(c => workspace.getIdentifier(c.target));
  const incoming = graph
    .getBacklinks(resource.uri)
    .map(c => workspace.getIdentifier(c.source));
  return { ...base, links: { outgoing, incoming } };
}

// ─── Read: id ─────────────────────────────────────────────────────────────────

export function noteIdData(
  workspace: FoamWorkspace,
  resource: Resource
): NoteIdResult {
  return {
    id: workspace.getIdentifier(resource.uri),
    uri: resource.uri,
  };
}

// ─── Internal helper ──────────────────────────────────────────────────────────

async function applyEditsToFiles(
  edits: WorkspaceTextEdit[],
  dataStore: IDataStore
): Promise<void> {
  for (const { uri, edits: fileEdits } of WorkspaceTextEdit.groupByUri(edits)) {
    const content = await dataStore.read(uri);
    if (content === null) {
      // The edit target disappeared between graph computation and apply,
      // or the datastore couldn't read it. Either way, applying edits to
      // empty content would silently truncate / recreate the file — fail
      // loudly so the caller can surface the I/O problem.
      throw new FoamError(
        'io_error',
        `Cannot apply edits: failed to read ${uri.toFsPath()}`,
        { uri: uri.toFsPath() }
      );
    }
    const updated = TextEdit.apply(content, fileEdits);
    await dataStore.write(uri, updated);
  }
}

// ─── Write: move ──────────────────────────────────────────────────────────────

/**
 * Moves/renames a note and rewrites all wikilinks pointing to it across the
 * workspace.
 *
 * Errors with `resource_exists` if the destination already exists, or
 * `invalid_input` if source equals destination.
 */
export async function noteMove(
  workspace: FoamWorkspace,
  graph: FoamGraph,
  dataStore: IDataStore,
  resource: Resource,
  newUri: URI
): Promise<NoteMoveResult> {
  const oldUri = resource.uri;

  if (oldUri.isEqual(newUri)) {
    throw new FoamError(
      'invalid_input',
      'Source and destination are the same.'
    );
  }

  if (await dataStore.exists(newUri)) {
    throw new FoamError(
      'resource_exists',
      `Destination already exists: ${newUri.toFsPath()}`,
      { uri: newUri.toFsPath() }
    );
  }

  const edits = computeWikilinkRenameEdits(workspace, graph, oldUri, newUri);
  await applyEditsToFiles(edits, dataStore);

  await dataStore.move(oldUri, newUri);

  const oldId = workspace.getIdentifier(oldUri);

  // Rebuild workspace state for the moved file so identifiers update
  workspace.delete(oldUri);
  workspace.set({ ...resource, uri: newUri });
  const newId = workspace.getIdentifier(newUri);

  return {
    old_uri: oldUri,
    new_uri: newUri,
    old_id: oldId,
    id: newId,
    updated_links: edits.length,
  };
}

// ─── Write: delete ────────────────────────────────────────────────────────────

/**
 * Deletes a note. By default, moves it to `.foam/trash/` (under the
 * workspace root that contains the resource), preserving the
 * resource's relative path. Pass `permanent: true` to hard-delete.
 */
export async function noteDelete(
  workspace: FoamWorkspace,
  dataStore: IDataStore,
  resource: Resource,
  opts: { permanent?: boolean }
): Promise<NoteDeleteResult> {
  const uri = resource.uri;

  if (opts.permanent) {
    await dataStore.delete(uri);
    return { uri, source_uri: uri, trashed: false };
  }

  const rootUri = getRootUriFor(workspace, uri);
  const relPath = relativeTo(uri.path, rootUri.path);
  // Derive the trash URI from the workspace root so it inherits the right
  // scheme/authority (file:// in Node, vscode-vfs:// in the web extension).
  const trashUri = rootUri.joinPath('.foam', 'trash', relPath);
  await dataStore.move(uri, trashUri);
  return { uri: trashUri, source_uri: uri, trashed: true };
}
