import path from 'node:path';
import { FoamGraph, FoamTags, FoamWorkspace, getTemplatesDir } from '@foam/core';
import { loadWorkspaceFromDirectory } from '../support/filesystem';
import {
  parseArgs,
  getString,
  getStrings,
  getFlag,
  resolveWorkspaceDir,
} from '../support/args';
import type { CliLogger, Format } from '../support/types';
import { uriToWorkspacePath } from '../support/workspace';

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

// ─── Domain functions ────────────────────────────────────────────────────────

export function listNotes(
  workspace: InstanceType<typeof FoamWorkspace>,
  rootDir: string,
  opts: { type?: string; tags?: string[]; limit?: number }
) {
  let resources = workspace.list();

  if (opts.type) {
    resources = resources.filter(r => r.type === opts.type);
  }

  if (opts.tags && opts.tags.length > 0) {
    resources = resources.filter(r =>
      opts.tags!.every(tag => r.tags.some(t => t.label === tag))
    );
  }

  if (opts.limit !== undefined) {
    resources = resources.slice(0, opts.limit);
  }

  return resources.map(r => ({
    id: workspace.getIdentifier(r.uri),
    uri: r.uri.toFsPath(),
    path: uriToWorkspacePath(r.uri, rootDir),
    title: r.title,
    type: r.type,
    tags: r.tags.map(t => t.label),
  }));
}

export function listTags(
  foamTags: InstanceType<typeof FoamTags>,
  opts: { prefix?: string; sort?: 'count' | 'name'; limit?: number }
) {
  let entries = Array.from(foamTags.tags.entries()).map(([tag, locations]) => ({
    tag,
    count: locations.length,
  }));

  if (opts.prefix) {
    entries = entries.filter(e => e.tag.startsWith(opts.prefix!));
  }

  entries.sort((a, b) =>
    opts.sort === 'count' ? b.count - a.count : a.tag.localeCompare(b.tag)
  );

  if (opts.limit !== undefined) {
    entries = entries.slice(0, opts.limit);
  }

  return entries;
}

export function listOrphans(
  workspace: InstanceType<typeof FoamWorkspace>,
  graph: InstanceType<typeof FoamGraph>,
  rootDir: string
) {
  return workspace.list().filter(r => {
    const outgoing = graph.getLinks(r.uri);
    const incoming = graph.getBacklinks(r.uri);
    return outgoing.length === 0 && incoming.length === 0;
  }).map(r => ({
    id: workspace.getIdentifier(r.uri),
    uri: r.uri.toFsPath(),
    path: uriToWorkspacePath(r.uri, rootDir),
    title: r.title,
  }));
}

export function listDeadends(
  workspace: InstanceType<typeof FoamWorkspace>,
  graph: InstanceType<typeof FoamGraph>,
  rootDir: string
) {
  return workspace.list().filter(r => {
    const outgoing = graph.getLinks(r.uri);
    return outgoing.length === 0;
  }).map(r => ({
    id: workspace.getIdentifier(r.uri),
    uri: r.uri.toFsPath(),
    path: uriToWorkspacePath(r.uri, rootDir),
    title: r.title,
  }));
}

export function listPlaceholders(
  workspace: InstanceType<typeof FoamWorkspace>,
  graph: InstanceType<typeof FoamGraph>,
  rootDir: string
) {
  return Array.from(graph.placeholders.values()).map(placeholderUri => {
    const backlinks = graph.getBacklinks(placeholderUri);
    return {
      placeholder_id: placeholderUri.path.split('/').pop()!,
      referenced_by: backlinks.map(conn => {
        const src = workspace.find(conn.source);
        return {
          id: workspace.getIdentifier(conn.source),
          uri: conn.source.toFsPath(),
          path: uriToWorkspacePath(conn.source, rootDir),
          title: src?.title ?? '',
        };
      }),
    };
  });
}

export async function listTemplates(rootDir: string) {
  const { createMarkdownParser } = await import('@foam/core');
  const fs = await import('node:fs/promises');
  const parser = createMarkdownParser();
  const templatesDir = getTemplatesDir(rootDir).toFsPath();

  try {
    const entries = await fs.readdir(templatesDir, { withFileTypes: true });
    const templates: Array<{ name: string; path: string; description?: string }> = [];

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

function formatNotesText(
  notes: ReturnType<typeof listNotes>
): string {
  if (notes.length === 0) return '(no notes found)';
  const maxPath = Math.max(...notes.map(n => n.path.length));
  return notes
    .map(n => `${n.path.padEnd(maxPath + 2)}${n.title}`)
    .join('\n');
}

function formatTagsText(tags: ReturnType<typeof listTags>): string {
  if (tags.length === 0) return '(no tags found)';
  const maxTag = Math.max(...tags.map(t => t.tag.length + 1)); // +1 for '#'
  return tags
    .map(t => `#${t.tag}`.padEnd(maxTag + 2) + `(${t.count} note${t.count === 1 ? '' : 's'})`)
    .join('\n');
}

function formatOrphansText(
  items: ReturnType<typeof listOrphans>
): string {
  if (items.length === 0) return '(no orphans found)';
  const maxPath = Math.max(...items.map(n => n.path.length));
  return items
    .map(n => `${n.path.padEnd(maxPath + 2)}${n.title}`)
    .join('\n');
}

function formatDeadendsText(items: ReturnType<typeof listDeadends>): string {
  if (items.length === 0) return '(no dead-end notes found)';
  const maxPath = Math.max(...items.map(n => n.path.length));
  return items
    .map(n => `${n.path.padEnd(maxPath + 2)}${n.title}`)
    .join('\n');
}

function formatPlaceholdersText(
  items: ReturnType<typeof listPlaceholders>
): string {
  if (items.length === 0) return '(no placeholders found)';
  return items
    .map(p => {
      const refs = p.referenced_by.map(r => r.path).join(', ');
      return `${p.placeholder_id}\n  referenced by: ${refs}`;
    })
    .join('\n');
}

function formatTemplatesText(
  templates: Awaited<ReturnType<typeof listTemplates>>
): string {
  if (templates.length === 0) return '(no templates found)';
  const maxName = Math.max(...templates.map(t => t.name.length));
  return templates
    .map(t =>
      `${t.name.padEnd(maxName + 2)}${t.description ?? ''}`
    )
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

  const validSubcommands = ['notes', 'tags', 'orphans', 'deadends', 'placeholders', 'templates'];
  if (!validSubcommands.includes(what)) {
    logger.error(`Unknown subcommand "${what}". Expected one of: ${validSubcommands.join(', ')}\n\n${LIST_HELP}`);
    return 1;
  }

  try {
    if (what === 'templates') {
      const templates = await listTemplates(workspaceDir);
      if (format === 'json') {
        logger.info(JSON.stringify(templates, null, 2));
      } else {
        logger.info(formatTemplatesText(templates));
      }
      return 0;
    }

    const { rootDir, workspace } = await loadWorkspaceFromDirectory(workspaceDir);

    if (what === 'notes') {
      const typeFilter = getString(parsed, 'type');
      const tagFlags = getStrings(parsed, 'tag');
      const limit = parseLimit(getString(parsed, 'limit'));
      const notes = listNotes(workspace, rootDir, { type: typeFilter, tags: tagFlags, limit });
      if (format === 'json') {
        logger.info(JSON.stringify(notes, null, 2));
      } else {
        logger.info(formatNotesText(notes));
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
      const items = listOrphans(workspace, graph, rootDir);
      if (format === 'json') {
        logger.info(JSON.stringify(items, null, 2));
      } else {
        logger.info(formatOrphansText(items));
      }
      return 0;
    }

    if (what === 'deadends') {
      const items = listDeadends(workspace, graph, rootDir);
      if (format === 'json') {
        logger.info(JSON.stringify(items, null, 2));
      } else {
        logger.info(formatDeadendsText(items));
      }
      return 0;
    }

    if (what === 'placeholders') {
      const items = listPlaceholders(workspace, graph, rootDir);
      if (format === 'json') {
        logger.info(JSON.stringify(items, null, 2));
      } else {
        logger.info(formatPlaceholdersText(items));
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
