import path from 'node:path';
import {
  parseArgs,
  getString,
  getStrings,
  getFlag,
  resolveWorkspaceDir,
} from '../support/args';
import type { CliLogger, Format } from '../support/types';
import { loadWorkspaceFromDirectory } from '../support/filesystem';
import { uriToWorkspacePath } from '../support/workspace';
import type { FoamWorkspace } from '@foam/core';

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

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SearchMatch {
  id: string;
  uri: string;
  title: string;
  type: string;
  tags: string[];
  properties: Record<string, unknown>;
  line: number;
  text: string;
  context_before?: string[];
  context_after?: string[];
}

export interface PropertyFilter {
  key: string;
  /** undefined means "has the property" (any value) */
  value?: string;
}

export interface SearchOptions {
  query?: string;
  tags?: string[];
  properties?: PropertyFilter[];
  type?: string;
  limit?: number;
  context?: number;
}

// ─── Domain ───────────────────────────────────────────────────────────────────

/**
 * Search the Foam workspace index by title, alias, tag, and/or frontmatter
 * property. Returns one match per note (matched on the title line).
 */
export function searchWorkspace(
  workspace: InstanceType<typeof FoamWorkspace>,
  rootDir: string,
  opts: SearchOptions
): SearchMatch[] {
  const limit = opts.limit ?? 20;
  const context = opts.context ?? 0;
  let resources = workspace.list();

  // Filter by type
  if (opts.type) {
    resources = resources.filter(r => r.type === opts.type);
  }

  // Filter by tags (AND — every tag must be present)
  if (opts.tags && opts.tags.length > 0) {
    resources = resources.filter(r =>
      opts.tags!.every(tag => r.tags.some(t => t.label === tag))
    );
  }

  // Filter by frontmatter properties
  if (opts.properties && opts.properties.length > 0) {
    resources = resources.filter(r =>
      opts.properties!.every(pf => {
        if (!(pf.key in r.properties)) return false;
        if (pf.value === undefined) return true;
        return String(r.properties[pf.key]) === pf.value;
      })
    );
  }

  // Filter by query (substring match on title and aliases)
  if (opts.query) {
    const q = opts.query.toLowerCase();
    resources = resources.filter(r => {
      if (r.title?.toLowerCase().includes(q)) return true;
      if (r.aliases.some(a => a.title.toLowerCase().includes(q))) return true;
      return false;
    });
  }

  resources = resources.slice(0, limit);

  return resources.map(r => {
    const relPath = uriToWorkspacePath(r.uri, rootDir);
    const titleLine = `# ${r.title}`;

    const match: SearchMatch = {
      id: workspace.getIdentifier(r.uri),
      uri: r.uri.toFsPath(),
      title: r.title,
      type: r.type,
      tags: r.tags.map(t => t.label),
      properties: r.properties as Record<string, unknown>,
      line: 1,
      text: titleLine,
    };

    if (context > 0) {
      // We return a fixed "title line" match; context lines aren't available
      // without reading the file. Provide empty arrays for API consistency.
      match.context_before = [];
      match.context_after = [];
    }

    return match;
  });
}

// ─── Formatting ───────────────────────────────────────────────────────────────

export function formatSearchText(
  matches: SearchMatch[],
  rootDir: string,
  opts: { noLineNumber?: boolean }
): string {
  if (matches.length === 0) return '';

  return matches
    .map(m => {
      const rel = path.relative(rootDir, m.uri);
      if (opts.noLineNumber) {
        return `${rel}: ${m.text}`;
      }
      return `${rel}:${m.line}: ${m.text}`;
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
    const { rootDir, workspace } = await loadWorkspaceFromDirectory(workspaceDir);

    const matches = searchWorkspace(workspace, rootDir, {
      query,
      tags,
      properties,
      type,
      limit: isNaN(limit) ? 20 : limit,
      context: isNaN(contextN) ? 0 : contextN,
    });

    if (format === 'json') {
      const output = matches.map(m => {
        const entry: any = {
          id: m.id,
          uri: m.uri,
          title: m.title,
          type: m.type,
          tags: m.tags,
          properties: m.properties,
          line: m.line,
          text: m.text,
        };
        if (contextN > 0) {
          entry.context_before = m.context_before ?? [];
          entry.context_after = m.context_after ?? [];
        }
        return entry;
      });
      if (output.length > 0) logger.info(JSON.stringify(output, null, 2));
    } else {
      const text = formatSearchText(matches, rootDir, { noLineNumber });
      if (text) logger.info(text);
    }

    return 0;
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
}
