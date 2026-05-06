import {
  TextEdit,
  WorkspaceTextEdit,
} from '../services/text-edit';
import { computeWikilinkRenameEdits } from '../services/link-integrity';
import { HeadingEdit } from '../services/heading-edit';
import { TagEdit } from '../services/tag-edit';
import { Resource } from '../model/note';
import { FoamGraph } from '../model/graph';
import { FoamTags } from '../model/tags';
import { FoamWorkspace } from '../model/workspace';
import { URI } from '../model/uri';
import { IDataStore } from '../services/datastore';
import { FoamError } from '../common/errors';
import { getDirectory, getExtension, joinPath } from '../utils/path';

// ─── Return types ─────────────────────────────────────────────────────────────

export interface RenameNoteResult {
  old_uri: URI;
  new_uri: URI;
  old_id: string;
  id: string;
  updated_links: number;
}

export interface RenameTagResult {
  old_tag: string;
  new_tag: string;
  updated_notes: number;
}

export interface RenameSectionResult {
  uri: URI;
  id: string;
  updated_links: number;
}

export interface RenameBlockResult {
  uri: URI;
  id: string;
  updated_links: number;
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

// ─── rename note ──────────────────────────────────────────────────────────────

/**
 * Renames a note (changing its filename stem, optionally moving it to a
 * different directory) and rewrites all wikilinks pointing to it across the
 * workspace.
 *
 * `newName` is the filename stem (no extension); the extension of the
 * existing file is preserved. `targetDir` is an optional URI of the new
 * parent directory; if omitted, the note keeps its current directory.
 *
 * The {@link FoamWorkspace} parameter is used both for link integrity
 * computations and to update its internal index after the move.
 */
export async function renameNote(
  workspace: FoamWorkspace,
  graph: FoamGraph,
  dataStore: IDataStore,
  resource: Resource,
  newName: string,
  targetDir?: URI
): Promise<RenameNoteResult> {
  const oldUri = resource.uri;
  const ext = getExtension(oldUri.path);
  const newUri = targetDir
    ? targetDir.joinPath(`${newName}${ext}`)
    : oldUri.forPath(joinPath(getDirectory(oldUri.path), `${newName}${ext}`));

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

// ─── rename tag ───────────────────────────────────────────────────────────────

/**
 * Renames a tag (and its hierarchical children) across all notes in the
 * workspace.
 *
 * Errors with code `invalid_input` if the rename would merge into an
 * existing tag and `force` is false. The error's `data.isMerge` flag lets
 * the caller render an appropriate hint (e.g. "use --force").
 */
export async function renameTag(
  tags: FoamTags,
  dataStore: IDataStore,
  oldTag: string,
  newTag: string,
  force: boolean
): Promise<RenameTagResult> {
  const cleanOld = oldTag.startsWith('#') ? oldTag.slice(1) : oldTag;
  const cleanNew = newTag.startsWith('#') ? newTag.slice(1) : newTag;

  const validation = TagEdit.validateTagRename(tags, cleanOld, cleanNew);
  if (!validation.isValid) {
    throw new FoamError(
      'invalid_input',
      validation.message ?? 'Invalid tag rename.'
    );
  }
  if (validation.isMerge && !force) {
    throw new FoamError(
      'invalid_input',
      validation.message ?? `Tag "${cleanNew}" already exists.`,
      { isMerge: true }
    );
  }

  const result = TagEdit.createHierarchicalRenameEdits(
    tags,
    cleanOld,
    cleanNew
  );
  await applyEditsToFiles(result.edits, dataStore);

  return {
    old_tag: cleanOld,
    new_tag: cleanNew,
    updated_notes: new Set(result.edits.map(e => e.uri.toFsPath())).size,
  };
}

// ─── rename section ───────────────────────────────────────────────────────────

/**
 * Renames a heading section in a note and rewrites all `[[note#Section]]`
 * inbound wikilinks across the workspace.
 */
export async function renameSection(
  workspace: FoamWorkspace,
  graph: FoamGraph,
  dataStore: IDataStore,
  resource: Resource,
  oldLabel: string,
  newLabel: string
): Promise<RenameSectionResult> {
  const section = Resource.findSection(resource, oldLabel);
  if (!section) {
    throw new FoamError(
      'invalid_input',
      `Section "${oldLabel}" not found in ${resource.uri.toFsPath()}`
    );
  }

  // Build a TextEdit for the heading line itself; HeadingEdit only emits
  // edits for inbound link rewrites, not the heading text.
  const content = await dataStore.read(resource.uri);
  if (content === null) {
    throw new FoamError(
      'io_error',
      `Cannot rename section: failed to read ${resource.uri.toFsPath()}`,
      { uri: resource.uri.toFsPath() }
    );
  }
  const lines = content.split('\n');
  const headingLine = lines[section.range.start.line];
  const match = headingLine.match(/^(#{1,6}\s+)/);
  const prefix = match ? match[1] : '';
  const headingEdit: WorkspaceTextEdit = {
    uri: resource.uri,
    edit: {
      range: {
        start: { line: section.range.start.line, character: prefix.length },
        end: { line: section.range.start.line, character: headingLine.length },
      },
      newText: newLabel,
    },
  };

  const result = HeadingEdit.createRenameSectionEdits(
    graph,
    workspace,
    resource.uri,
    oldLabel,
    newLabel
  );

  await applyEditsToFiles([headingEdit, ...result.edits], dataStore);

  return {
    uri: resource.uri,
    id: workspace.getIdentifier(resource.uri),
    updated_links: result.totalOccurrences,
  };
}

// ─── rename block ─────────────────────────────────────────────────────────────

/**
 * Renames a block anchor (`^id`) in a note and rewrites all `[[note#^id]]`
 * inbound wikilinks across the workspace.
 */
export async function renameBlock(
  workspace: FoamWorkspace,
  graph: FoamGraph,
  dataStore: IDataStore,
  resource: Resource,
  oldId: string,
  newId: string
): Promise<RenameBlockResult> {
  const block = Resource.findBlock(resource, oldId);
  if (!block) {
    throw new FoamError(
      'invalid_input',
      `Block ^${oldId} not found in ${resource.uri.toFsPath()}`
    );
  }

  const result = HeadingEdit.createRenameBlockEdits(
    graph,
    workspace,
    resource.uri,
    oldId,
    newId
  );

  const anchorEdit: WorkspaceTextEdit = {
    uri: resource.uri,
    edit: { range: block.markerRange, newText: `^${newId}` },
  };

  await applyEditsToFiles([anchorEdit, ...result.edits], dataStore);

  return {
    uri: resource.uri,
    id: workspace.getIdentifier(resource.uri),
    updated_links: result.totalOccurrences,
  };
}
