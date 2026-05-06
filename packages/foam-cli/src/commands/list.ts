import path from 'node:path';
import fs from 'node:fs/promises';
import {
  createMarkdownParser,
  FoamGraph,
  FoamTags,
  FoamWorkspace,
  URI,
  getTemplatesDir,
  listNotes,
  listTags,
  listOrphans,
  listDeadends,
  listPlaceholders,
  uriToWorkspacePath,
} from '@foam/core';
import { loadWorkspaceFromDirectory } from '../support/filesystem';
import {
  parseArgs,
  getString,
  getStrings,
  getFlag,
  resolveWorkspaceDir,
} from '../support/args';
import type { CliLogger, Format } from '../support/types';
import { dim, path as pathColor } from '../support/colors';
import {
  serializeNoteItem,
  serializeNoteSummary,
  serializePlaceholder,
} from '../support/serializers';

// Re-export domain functions for any external consumers
export {
  listNotes,
  listTags,
  listOrphans,
  listDeadends,
  listPlaceholders,
} from '@foam/core';

// ─── Help ────────────────────────────────────────────────────────────────────

export const LIST_HELP = `Usage: foam list <what> [options]

<what>: notes | tags | orphans | deadends | placeholders | templates

Options:
  --type <type>        (notes) Filter by type: note, daily-note, attachment, image
  --tag <tag>          (notes) Filter by tag (repeatable via multiple --tag flags)
  --limit <n>          (notes/tags) Max results
  --prefix <str>       (tags) Filter by prefix
  --sort <count|name>  (tags) Sort order (default: name)
  --workspace <dir>    Workspace root (default: FOAM_WORKSPACE env var, then cwd)
  --format <fmt>       text (default) or json
  --help               Show this help
`;

// ─── listTemplates (CLI-only — uses Node fs to scan disk) ────────────────────

export async function listTemplates(rootUri: URI) {
  const parser = createMarkdownParser();
  const templatesDir = getTemplatesDir(rootUri).toFsPath();

  try {
    const entries = await fs.readdir(templatesDir, { withFileTypes: true });
    const templates: Array<{
      name: string;
      path: string;
      description?: string;
    }> = [];

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name);
      if (ext !== '.md' && ext !== '.js') continue;
      const name = path.basename(entry.name, ext);
      const fullPath = path.join(templatesDir, entry.name);
      let description: string | undefined;

      if (ext === '.md') {
        try {
          const content = await fs.readFile(fullPath, 'utf8');
          const resource = parser.parse(
            { path: fullPath, scheme: 'file' } as any,
            content
          );
          description = resource.properties['foam_template']?.description;
        } catch {
          // ignore parse errors
        }
      }

      templates.push({ name, path: fullPath, description });
    }

    return templates;
  } catch {
    return [];
  }
}

// ─── Formatters ──────────────────────────────────────────────────────────────

// Colorize a value while preserving column width: pad first (using raw width),
// then color only the value, then append the padding. ANSI codes have zero
// visible width, so coloring after padding keeps alignment intact.
function padAndColorPath(value: string, totalWidth: number): string {
  const padding = ' '.repeat(Math.max(0, totalWidth - value.length));
  return `${pathColor(value)}${padding}`;
}

function formatNotesText(
  notes: ReturnType<typeof listNotes>,
  workspace: FoamWorkspace
): string {
  if (notes.length === 0) return dim('(no notes found)');
  const paths = notes.map(n => uriToWorkspacePath(n.uri, workspace));
  const maxPath = Math.max(...paths.map(p => p.length));
  return notes
    .map((n, i) => `${padAndColorPath(paths[i], maxPath + 2)}${n.title}`)
    .join('\n');
}

function formatTagsText(tags: ReturnType<typeof listTags>): string {
  if (tags.length === 0) return dim('(no tags found)');
  const maxTag = Math.max(...tags.map(t => t.tag.length + 1)); // +1 for '#'
  return tags
    .map(t => {
      const tagText = `#${t.tag}`;
      const count = `(${t.count} note${t.count === 1 ? '' : 's'})`;
      return `${padAndColorPath(tagText, maxTag + 2)}${dim(count)}`;
    })
    .join('\n');
}

function formatSummariesText(
  items: ReturnType<typeof listOrphans>,
  workspace: FoamWorkspace,
  emptyMessage: string
): string {
  if (items.length === 0) return dim(emptyMessage);
  const paths = items.map(n => uriToWorkspacePath(n.uri, workspace));
  const maxPath = Math.max(...paths.map(p => p.length));
  return items
    .map((n, i) => `${padAndColorPath(paths[i], maxPath + 2)}${n.title}`)
    .join('\n');
}

function formatPlaceholdersText(
  items: ReturnType<typeof listPlaceholders>,
  workspace: FoamWorkspace
): string {
  if (items.length === 0) return dim('(no placeholders found)');
  return items
    .map(p => {
      const refs = p.referenced_by
        .map(r => pathColor(uriToWorkspacePath(r.uri, workspace)))
        .join(dim(', '));
      return `${pathColor(p.placeholder_id)}\n  ${dim('referenced by:')} ${refs}`;
    })
    .join('\n');
}

function formatTemplatesText(
  templates: Awaited<ReturnType<typeof listTemplates>>
): string {
  if (templates.length === 0) return dim('(no templates found)');
  const maxName = Math.max(...templates.map(t => t.name.length));
  return templates
    .map(t => `${padAndColorPath(t.name, maxName + 2)}${t.description ?? ''}`)
    .join('\n');
}

// ─── Command runner ───────────────────────────────────────────────────────────

export async function runListCommand(
  argv: string[],
  logger: CliLogger
): Promise<number> {
  const [what, ...rest] = argv;

  if (!what || what === '--help' || what === '-h') {
    logger.info(LIST_HELP);
    return 0;
  }

  const parsed = parseArgs(rest);

  if (getFlag(parsed, 'help')) {
    logger.info(LIST_HELP);
    return 0;
  }

  const format: Format = (getString(parsed, 'format') as Format) ?? 'text';
  const workspaceDir = resolveWorkspaceDir(parsed);

  const validSubcommands = [
    'notes',
    'tags',
    'orphans',
    'deadends',
    'placeholders',
    'templates',
  ];
  if (!validSubcommands.includes(what)) {
    logger.error(
      `Unknown subcommand "${what}". Expected one of: ${validSubcommands.join(', ')}\n\n${LIST_HELP}`
    );
    return 1;
  }

  try {
    const { rootUri, workspace } =
      await loadWorkspaceFromDirectory(workspaceDir);

    if (what === 'templates') {
      const templates = await listTemplates(rootUri);
      if (format === 'json') {
        logger.info(JSON.stringify(templates, null, 2));
      } else {
        logger.info(formatTemplatesText(templates));
      }
      return 0;
    }

    if (what === 'notes') {
      const typeFilter = getString(parsed, 'type');
      const tagFlags = getStrings(parsed, 'tag');
      const limit = parseLimit(getString(parsed, 'limit'));
      const notes = listNotes(workspace, {
        type: typeFilter,
        tags: tagFlags,
        limit,
      });
      if (format === 'json') {
        logger.info(
          JSON.stringify(
            notes.map(n => serializeNoteItem(n, workspace)),
            null,
            2
          )
        );
      } else {
        logger.info(formatNotesText(notes, workspace));
      }
      return 0;
    }

    // Commands that need the graph
    const graph = FoamGraph.fromWorkspace(workspace);

    if (what === 'tags') {
      const foamTags = FoamTags.fromWorkspace(workspace);
      const prefix = getString(parsed, 'prefix');
      const sort = getString(parsed, 'sort') as 'count' | 'name' | undefined;
      const limit = parseLimit(getString(parsed, 'limit'));
      const tags = listTags(foamTags, { prefix, sort, limit });
      if (format === 'json') {
        logger.info(JSON.stringify(tags, null, 2));
      } else {
        logger.info(formatTagsText(tags));
      }
      return 0;
    }

    if (what === 'orphans') {
      const items = listOrphans(workspace, graph);
      if (format === 'json') {
        logger.info(
          JSON.stringify(
            items.map(n => serializeNoteSummary(n, workspace)),
            null,
            2
          )
        );
      } else {
        logger.info(formatSummariesText(items, workspace, '(no orphans found)'));
      }
      return 0;
    }

    if (what === 'deadends') {
      const items = listDeadends(workspace, graph);
      if (format === 'json') {
        logger.info(
          JSON.stringify(
            items.map(n => serializeNoteSummary(n, workspace)),
            null,
            2
          )
        );
      } else {
        logger.info(
          formatSummariesText(items, workspace, '(no dead-end notes found)')
        );
      }
      return 0;
    }

    if (what === 'placeholders') {
      const items = listPlaceholders(workspace, graph);
      if (format === 'json') {
        logger.info(
          JSON.stringify(
            items.map(p => serializePlaceholder(p, workspace)),
            null,
            2
          )
        );
      } else {
        logger.info(formatPlaceholdersText(items, workspace));
      }
      return 0;
    }

    return 0;
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseLimit(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = parseInt(value, 10);
  return isNaN(n) ? undefined : n;
}
