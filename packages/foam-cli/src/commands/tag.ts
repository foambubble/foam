import { FoamTags } from '@foam/core';
import { loadWorkspaceFromDirectory } from '../support/filesystem';
import {
  parseArgs,
  getString,
  getFlag,
  resolveWorkspaceDir,
} from '../support/args';
import type { CliLogger, Format } from '../support/types';
import { runListCommand } from './list';
import { renameTag } from './rename';
import { runSearchCommand } from './search';
import { dim, path as pathColor, success } from '../support/colors';

// Help

export const TAG_HELP = `Usage: foam tag <subcommand> [options]

Subcommands:
  list                         List tags (alias for: foam list tags)
  rename <old> <new>           Rename a tag and its hierarchical children
  search <tag>                 Search notes by tag (alias for: foam search --tag <tag>)

Options:
  --force              (rename) Skip confirmation when renaming would merge tags
  --workspace <dir>    Workspace root (default: FOAM_WORKSPACE env var, then cwd)
  --format <fmt>       text (default) or json
  --help               Show this help
`;

// Domain

export function cleanTag(tag: string): string {
  return tag.startsWith('#') ? tag.slice(1) : tag;
}

// Command runner

export async function runTagCommand(
  argv: string[],
  logger: CliLogger
): Promise<number> {
  const [subcommand, ...rest] = argv;

  if (!subcommand || subcommand === '--help' || subcommand === '-h') {
    logger.info(TAG_HELP);
    return 0;
  }

  const validSubcommands = ['list', 'rename', 'search'];
  if (!validSubcommands.includes(subcommand)) {
    logger.error(
      `Unknown subcommand "${subcommand}". Expected one of: ${validSubcommands.join(', ')}\n\n${TAG_HELP}`
    );
    return 1;
  }

  if (subcommand === 'list') {
    return runListCommand(['tags', ...rest], logger);
  }

  if (subcommand === 'search') {
    const parsed = parseArgs(rest);
    if (getFlag(parsed, 'help')) {
      logger.info(TAG_HELP);
      return 0;
    }
    const [tag] = parsed.positionals;
    if (!tag) {
      logger.error('Usage: foam tag search <tag>');
      return 1;
    }
    const tagIndex = rest.indexOf(tag);
    const aliasedArgs =
      tagIndex === -1
        ? rest
        : [...rest.slice(0, tagIndex), ...rest.slice(tagIndex + 1)];
    return runSearchCommand(['--tag', cleanTag(tag), ...aliasedArgs], logger);
  }

  const parsed = parseArgs(rest);

  if (getFlag(parsed, 'help')) {
    logger.info(TAG_HELP);
    return 0;
  }

  const format: Format = (getString(parsed, 'format') as Format) ?? 'text';
  const workspaceDir = resolveWorkspaceDir(parsed);

  try {
    if (subcommand === 'rename') {
      const [oldTag, newTag] = parsed.positionals;
      if (!oldTag || !newTag) {
        logger.error('Usage: foam tag rename <old> <new>');
        return 1;
      }

      const { rootDir, foam } = await loadWorkspaceFromDirectory(workspaceDir);
      const tags = FoamTags.fromWorkspace(foam.workspace);
      const result = await renameTag(
        tags,
        rootDir,
        oldTag,
        newTag,
        getFlag(parsed, 'force')
      );

      if (format === 'json') {
        logger.info(JSON.stringify(result, null, 2));
      } else {
        logger.info(
          `${success('Renamed:')} ${pathColor(`#${result.old_tag}`)} ${dim('->')} ${pathColor(`#${result.new_tag}`)}  ${dim(`(${result.updated_notes} note${result.updated_notes === 1 ? '' : 's'} updated)`)}`
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
