import {
  parseArgs,
  getString,
  getStrings,
  getFlag,
  resolveWorkspaceDir,
} from '../support/args';
import type { CliLogger, Format } from '../support/types';
import { loadWorkspaceFromDirectory } from '../support/filesystem';
import {
  FoamWorkspace,
  searchWorkspace,
  uriToWorkspacePath,
  type PropertyFilter,
  type SearchMatch,
  type SearchOptions,
} from '@foam/core';
import { serializeSearchMatch } from '../support/serializers';
import { dim, path as pathColor } from '../support/colors';

// Re-export domain function and types
export {
  searchWorkspace,
  type PropertyFilter,
  type SearchMatch,
  type SearchOptions,
} from '@foam/core';

// ─── Help ─────────────────────────────────────────────────────────────────────

export const SEARCH_HELP = `Usage: foam search [<query>] [options]

Search notes by title, alias, tag, or frontmatter property.
<query> matches note titles and aliases (substring, case-insensitive).

Options:
  --tag <tag>           Filter by tag (repeatable for AND)
  --property <key=val>  Filter by frontmatter property
                        (omit =val to match any note that has the property)
  --type <type>         Filter by resource type: note, daily-note, attachment, image
  --context <n>         Show n lines of surrounding context around each match
  --no-line-number      Omit line numbers from output
  --limit <n>           Max results (default: 20)
  --workspace <dir>     Workspace root (default: FOAM_WORKSPACE env var, then cwd)
  --format <fmt>        text (default) or json
  --help                Show this help
`;

// ─── Formatting ───────────────────────────────────────────────────────────────

export function formatSearchText(
  matches: SearchMatch[],
  workspace: FoamWorkspace,
  opts: { noLineNumber?: boolean }
): string {
  if (matches.length === 0) return '';

  return matches
    .map(m => {
      const rel = uriToWorkspacePath(m.uri, workspace);
      if (opts.noLineNumber) {
        return `${pathColor(rel)}${dim(':')} ${m.text}`;
      }
      return `${pathColor(rel)}${dim(`:${m.line}:`)} ${m.text}`;
    })
    .join('\n');
}

// ─── Command runner ───────────────────────────────────────────────────────────

export async function runSearchCommand(
  argv: string[],
  logger: CliLogger
): Promise<number> {
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    if (argv.length === 0) {
      // allow no-arg invocation — filters only
    } else {
      logger.info(SEARCH_HELP);
      return 0;
    }
  }

  const [first, ...rest] = argv;
  const isFlag = first === undefined || first.startsWith('--') || first === '-h';
  const query = isFlag ? undefined : first;
  const parsed = parseArgs(isFlag ? argv : rest);

  if (getFlag(parsed, 'help')) {
    logger.info(SEARCH_HELP);
    return 0;
  }

  const format: Format = (getString(parsed, 'format') as Format) ?? 'text';
  const workspaceDir = resolveWorkspaceDir(parsed);
  const noLineNumber = getFlag(parsed, 'no-line-number');
  const contextN = parseInt(getString(parsed, 'context') ?? '0', 10);
  const limit = parseInt(getString(parsed, 'limit') ?? '20', 10);
  const tags = getStrings(parsed, 'tag');
  const type = getString(parsed, 'type');

  const propertyStrings = getStrings(parsed, 'property');
  const properties: PropertyFilter[] = propertyStrings.map(p => {
    const eqIdx = p.indexOf('=');
    if (eqIdx === -1) return { key: p };
    return { key: p.slice(0, eqIdx), value: p.slice(eqIdx + 1) };
  });

  try {
    const { workspace } = await loadWorkspaceFromDirectory(workspaceDir);

    const matches = searchWorkspace(workspace, {
      query,
      tags,
      properties,
      type,
      limit: isNaN(limit) ? 20 : limit,
      context: isNaN(contextN) ? 0 : contextN,
    });

    if (format === 'json') {
      logger.info(
        JSON.stringify(
          matches.map(m => serializeSearchMatch(m, workspace)),
          null,
          2
        )
      );
    } else {
      const text = formatSearchText(matches, workspace, { noLineNumber });
      if (text) logger.info(text);
    }

    return 0;
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
}
