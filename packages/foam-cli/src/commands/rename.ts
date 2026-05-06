import path from 'node:path';

import {
  FoamError,
  FoamGraph,
  FoamTags,
  URI,
  renameNote,
  renameTag,
  renameSection,
  renameBlock,
  resolveNote,
} from '@foam/core';
import { loadWorkspaceFromDirectory } from '../support/filesystem';
import {
  parseArgs,
  getString,
  getFlag,
  resolveWorkspaceDir,
  noteRefFromCliArgs,
} from '../support/args';
import type { CliLogger, Format } from '../support/types';
import { dim, path as pathColor, success } from '../support/colors';

// Re-export domain functions
export {
  renameNote,
  renameTag,
  renameSection,
  renameBlock,
} from '@foam/core';

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
      const { foam, dataStore } =
        await loadWorkspaceFromDirectory(workspaceDir);
      const tags = FoamTags.fromWorkspace(foam.workspace);
      const result = await renameTag(tags, dataStore, oldTag, newTag, force);
      if (format === 'json') {
        logger.info(JSON.stringify(result, null, 2));
      } else {
        logger.info(
          `${success('Renamed:')} ${pathColor(`#${result.old_tag}`)} ${dim('→')} ${pathColor(`#${result.new_tag}`)}  ${dim(`(${result.updated_notes} note${result.updated_notes === 1 ? '' : 's'} updated)`)}`
        );
      }
      return 0;
    }

    const { rootDir, workspace, dataStore } =
      await loadWorkspaceFromDirectory(workspaceDir);
    const identifier = parsed.positionals[0];
    const ref = noteRefFromCliArgs(identifier, pathFlag, rootDir);
    const resource = resolveNote(workspace, ref);

    if (subcommand === 'note') {
      const newName = parsed.positionals[1];
      if (!newName) {
        logger.error('Usage: foam rename note <identifier> <new-name>');
        return 1;
      }
      const targetPath = getString(parsed, 'target-path');
      const targetDir = targetPath
        ? URI.file(
            path.isAbsolute(targetPath)
              ? targetPath
              : path.resolve(rootDir, targetPath)
          )
        : undefined;
      const graph = FoamGraph.fromWorkspace(workspace);
      const result = await renameNote(
        workspace,
        graph,
        dataStore,
        resource,
        newName,
        targetDir
      );
      if (format === 'json') {
        logger.info(
          JSON.stringify(
            {
              old_uri: result.old_uri.toFsPath(),
              new_uri: result.new_uri.toFsPath(),
              old_id: result.old_id,
              id: result.id,
              updated_links: result.updated_links,
            },
            null,
            2
          )
        );
      } else {
        logger.info(
          `${success('Renamed:')} ${pathColor(path.relative(rootDir, result.old_uri.toFsPath()))} ${dim('→')} ${pathColor(path.relative(rootDir, result.new_uri.toFsPath()))}  ${dim(`(id: ${result.id}, ${result.updated_links} link${result.updated_links === 1 ? '' : 's'} updated)`)}`
        );
      }
      return 0;
    }

    const graph = FoamGraph.fromWorkspace(workspace);

    if (subcommand === 'section') {
      const oldLabel = parsed.positionals[1];
      const newLabel = parsed.positionals[2];
      if (!oldLabel || !newLabel) {
        logger.error(
          'Usage: foam rename section <identifier> <old-label> <new-label>'
        );
        return 1;
      }
      const result = await renameSection(
        workspace,
        graph,
        dataStore,
        resource,
        oldLabel,
        newLabel
      );
      if (format === 'json') {
        logger.info(
          JSON.stringify(
            {
              uri: result.uri.toFsPath(),
              id: result.id,
              updated_links: result.updated_links,
            },
            null,
            2
          )
        );
      } else {
        logger.info(
          `${success('Renamed section')} "${oldLabel}" ${dim('→')} "${newLabel}" in ${pathColor(path.relative(rootDir, result.uri.toFsPath()))}  ${dim(`(${result.updated_links} link${result.updated_links === 1 ? '' : 's'} updated)`)}`
        );
      }
      return 0;
    }

    if (subcommand === 'block') {
      const oldBlockId = parsed.positionals[1];
      const newBlockId = parsed.positionals[2];
      if (!oldBlockId || !newBlockId) {
        logger.error(
          'Usage: foam rename block <identifier> <old-id> <new-id>'
        );
        return 1;
      }
      const result = await renameBlock(
        workspace,
        graph,
        dataStore,
        resource,
        oldBlockId,
        newBlockId
      );
      if (format === 'json') {
        logger.info(
          JSON.stringify(
            {
              uri: result.uri.toFsPath(),
              id: result.id,
              updated_links: result.updated_links,
            },
            null,
            2
          )
        );
      } else {
        logger.info(
          `${success('Renamed block')} ${pathColor(`^${oldBlockId}`)} ${dim('→')} ${pathColor(`^${newBlockId}`)} in ${pathColor(path.relative(rootDir, result.uri.toFsPath()))}  ${dim(`(${result.updated_links} link${result.updated_links === 1 ? '' : 's'} updated)`)}`
        );
      }
      return 0;
    }

    return 0;
  } catch (err) {
    if (err instanceof FoamError && err.data?.isMerge) {
      logger.error(`${err.message}\nUse --force to proceed with the merge.`);
      return 1;
    }
    logger.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
}
