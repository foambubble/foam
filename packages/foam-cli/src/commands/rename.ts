import fs from 'node:fs/promises';
import path from 'node:path';

import {
  FoamGraph,
  FoamTags,
  FoamWorkspace,
  TextEdit,
  URI,
  WorkspaceTextEdit,
  computeWikilinkRenameEdits,
  HeadingEdit,
  TagEdit,
} from '@foam/core';
import { loadWorkspaceFromDirectory } from '../support/filesystem';
import {
  parseArgs,
  getString,
  getFlag,
  resolveWorkspaceDir,
} from '../support/args';
import type { CliLogger, Format } from '../support/types';
import { resolveNote } from '../support/workspace';

// ─── Help ────────────────────────────────────────────────────────────────────

export const RENAME_HELP = `Usage: foam rename <subcommand> [options]

Subcommands:
  note <identifier> <new-name>           Rename a note and rewrite all wikilinks
  tag <old> <new>                        Rename a tag (and its hierarchical children)
  section <identifier> <old> <new>       Rename a heading section and rewrite links
  block <identifier> <old-id> <new-id>   Rename a block anchor and rewrite links

Options (all subcommands):
  --path <path>        Target by exact path instead of identifier resolution
  --force              Skip confirmation when a tag rename would merge tags
  --target-path <path> (note only) Move to a different directory
  --workspace <dir>    Workspace root (default: FOAM_WORKSPACE env var, then cwd)
  --format <fmt>       text (default) or json
  --help               Show this help
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function applyEditsToFiles(
  edits: { uri: URI; edit: TextEdit }[]
): Promise<void> {
  for (const { uri, edits: fileEdits } of WorkspaceTextEdit.groupByUri(edits)) {
    let content = await fs.readFile(uri.toFsPath(), 'utf8');
    content = TextEdit.apply(content, fileEdits);
    await fs.writeFile(uri.toFsPath(), content, 'utf8');
  }
}

// ─── Domain: rename note ──────────────────────────────────────────────────────

export async function renameNote(
  workspace: InstanceType<typeof FoamWorkspace>,
  graph: InstanceType<typeof FoamGraph>,
  rootDir: string,
  identifier: string | undefined,
  pathFlag: string | undefined,
  newName: string,
  targetPath?: string
): Promise<{ old_uri: string; new_uri: string; old_id: string; id: string; updated_links: number }> {
  const resource = resolveNote(workspace, identifier, pathFlag, rootDir);
  const oldUri = resource.uri;

  let newFsPath: string;
  if (targetPath) {
    newFsPath = path.resolve(rootDir, targetPath, `${newName}${path.extname(oldUri.toFsPath())}`);
  } else {
    newFsPath = path.join(path.dirname(oldUri.toFsPath()), `${newName}${path.extname(oldUri.toFsPath())}`);
  }
  const newUri = URI.file(newFsPath);

  if (oldUri.isEqual(newUri)) {
    throw new Error('Source and destination are the same.');
  }

  try {
    await fs.access(newFsPath);
    throw new Error(`Destination already exists: ${newFsPath}`);
  } catch (err: any) {
    if (err.code !== 'ENOENT') throw err;
  }

  const edits = computeWikilinkRenameEdits(workspace, graph, oldUri, newUri);
  await applyEditsToFiles(edits);

  await fs.mkdir(path.dirname(newFsPath), { recursive: true });
  await fs.rename(oldUri.toFsPath(), newFsPath);

  const oldId = workspace.getIdentifier(oldUri);
  workspace.delete(oldUri);
  workspace.set({ ...resource, uri: newUri });
  const newId = workspace.getIdentifier(newUri);

  return {
    old_uri: oldUri.toFsPath(),
    new_uri: newFsPath,
    old_id: oldId,
    id: newId,
    updated_links: edits.length,
  };
}

// ─── Domain: rename tag ───────────────────────────────────────────────────────

export async function renameTag(
  tags: InstanceType<typeof FoamTags>,
  rootDir: string,
  oldTag: string,
  newTag: string,
  force: boolean
): Promise<{ old_tag: string; new_tag: string; updated_notes: number }> {
  const cleanOld = oldTag.startsWith('#') ? oldTag.slice(1) : oldTag;
  const cleanNew = newTag.startsWith('#') ? newTag.slice(1) : newTag;

  const validation = TagEdit.validateTagRename(tags, cleanOld, cleanNew);
  if (!validation.isValid) {
    throw new Error(validation.message ?? 'Invalid tag rename.');
  }
  if (validation.isMerge && !force) {
    throw new Error(
      `${validation.message}\nUse --force to proceed with the merge.`
    );
  }

  const result = TagEdit.createHierarchicalRenameEdits(tags, cleanOld, cleanNew);
  await applyEditsToFiles(result.edits);

  return {
    old_tag: cleanOld,
    new_tag: cleanNew,
    updated_notes: new Set(result.edits.map(e => e.uri.toFsPath())).size,
  };
}

// ─── Domain: rename section ───────────────────────────────────────────────────

export async function renameSection(
  workspace: InstanceType<typeof FoamWorkspace>,
  graph: InstanceType<typeof FoamGraph>,
  rootDir: string,
  identifier: string | undefined,
  pathFlag: string | undefined,
  oldLabel: string,
  newLabel: string
): Promise<{ uri: string; id: string; updated_links: number }> {
  const resource = resolveNote(workspace, identifier, pathFlag, rootDir);
  const result = HeadingEdit.createRenameSectionEdits(
    graph,
    workspace,
    resource.uri,
    oldLabel,
    newLabel
  );

  // Update the heading text in the note itself
  const filePath = resource.uri.toFsPath();
  let content = await fs.readFile(filePath, 'utf8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,6}\s+)(.+)$/);
    if (match && match[2].trim() === oldLabel) {
      lines[i] = match[1] + newLabel;
      break;
    }
  }
  content = lines.join('\n');
  await fs.writeFile(filePath, content, 'utf8');

  await applyEditsToFiles(result.edits);

  return {
    uri: resource.uri.toFsPath(),
    id: workspace.getIdentifier(resource.uri),
    updated_links: result.totalOccurrences,
  };
}

// ─── Domain: rename block ─────────────────────────────────────────────────────

export async function renameBlock(
  workspace: InstanceType<typeof FoamWorkspace>,
  graph: InstanceType<typeof FoamGraph>,
  rootDir: string,
  identifier: string | undefined,
  pathFlag: string | undefined,
  oldId: string,
  newId: string
): Promise<{ uri: string; id: string; updated_links: number }> {
  const resource = resolveNote(workspace, identifier, pathFlag, rootDir);
  const result = HeadingEdit.createRenameBlockEdits(
    graph,
    workspace,
    resource.uri,
    oldId,
    newId
  );

  // Update the block anchor text in the note itself
  const filePath = resource.uri.toFsPath();
  let content = await fs.readFile(filePath, 'utf8');
  content = content.replace(
    new RegExp(`\\^${oldId}(?=\\s|$)`, 'g'),
    `^${newId}`
  );
  await fs.writeFile(filePath, content, 'utf8');

  await applyEditsToFiles(result.edits);

  return {
    uri: resource.uri.toFsPath(),
    id: workspace.getIdentifier(resource.uri),
    updated_links: result.totalOccurrences,
  };
}

// ─── Command runner ───────────────────────────────────────────────────────────

export async function runRenameCommand(
  argv: string[],
  logger: CliLogger
): Promise<number> {
  const [subcommand, ...rest] = argv;

  if (!subcommand || subcommand === '--help' || subcommand === '-h') {
    logger.info(RENAME_HELP);
    return 0;
  }

  const parsed = parseArgs(rest);

  if (getFlag(parsed, 'help')) {
    logger.info(RENAME_HELP);
    return 0;
  }

  const format: Format = (getString(parsed, 'format') as Format) ?? 'text';
  const workspaceDir = resolveWorkspaceDir(parsed);
  const pathFlag = getString(parsed, 'path');
  const force = getFlag(parsed, 'force');

  const validSubcommands = ['note', 'tag', 'section', 'block'];
  if (!validSubcommands.includes(subcommand)) {
    logger.error(
      `Unknown subcommand "${subcommand}". Expected one of: ${validSubcommands.join(', ')}\n\n${RENAME_HELP}`
    );
    return 1;
  }

  try {
    if (subcommand === 'tag') {
      const [oldTag, newTag] = parsed.positionals;
      if (!oldTag || !newTag) {
        logger.error('Usage: foam rename tag <old> <new>');
        return 1;
      }
      const { rootDir, foam } = await loadWorkspaceFromDirectory(workspaceDir);
      const tags = FoamTags.fromWorkspace(foam.workspace);
      const result = await renameTag(tags, rootDir, oldTag, newTag, force);
      if (format === 'json') {
        logger.info(JSON.stringify(result, null, 2));
      } else {
        logger.info(
          `Renamed: #${result.old_tag} → #${result.new_tag}  (${result.updated_notes} note${result.updated_notes === 1 ? '' : 's'} updated)`
        );
      }
      return 0;
    }

    const { rootDir, workspace } = await loadWorkspaceFromDirectory(workspaceDir);
    const identifier = parsed.positionals[0];

    if (subcommand === 'note') {
      const newName = parsed.positionals[1];
      if (!newName) {
        logger.error('Usage: foam rename note <identifier> <new-name>');
        return 1;
      }
      const targetPath = getString(parsed, 'target-path');
      const graph = FoamGraph.fromWorkspace(workspace);
      const result = await renameNote(workspace, graph, rootDir, identifier, pathFlag, newName, targetPath);
      if (format === 'json') {
        logger.info(JSON.stringify(result, null, 2));
      } else {
        logger.info(
          `Renamed: ${path.relative(rootDir, result.old_uri)} → ${path.relative(rootDir, result.new_uri)}  (id: ${result.id}, ${result.updated_links} link${result.updated_links === 1 ? '' : 's'} updated)`
        );
      }
      return 0;
    }

    const graph = FoamGraph.fromWorkspace(workspace);

    if (subcommand === 'section') {
      const oldLabel = parsed.positionals[1];
      const newLabel = parsed.positionals[2];
      if (!oldLabel || !newLabel) {
        logger.error('Usage: foam rename section <identifier> <old-label> <new-label>');
        return 1;
      }
      const result = await renameSection(workspace, graph, rootDir, identifier, pathFlag, oldLabel, newLabel);
      if (format === 'json') {
        logger.info(JSON.stringify(result, null, 2));
      } else {
        logger.info(
          `Renamed section "${oldLabel}" → "${newLabel}" in ${path.relative(rootDir, result.uri)}  (${result.updated_links} link${result.updated_links === 1 ? '' : 's'} updated)`
        );
      }
      return 0;
    }

    if (subcommand === 'block') {
      const oldBlockId = parsed.positionals[1];
      const newBlockId = parsed.positionals[2];
      if (!oldBlockId || !newBlockId) {
        logger.error('Usage: foam rename block <identifier> <old-id> <new-id>');
        return 1;
      }
      const result = await renameBlock(workspace, graph, rootDir, identifier, pathFlag, oldBlockId, newBlockId);
      if (format === 'json') {
        logger.info(JSON.stringify(result, null, 2));
      } else {
        logger.info(
          `Renamed block ^${oldBlockId} → ^${newBlockId} in ${path.relative(rootDir, result.uri)}  (${result.updated_links} link${result.updated_links === 1 ? '' : 's'} updated)`
        );
      }
      return 0;
    }

    return 0;
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
}
