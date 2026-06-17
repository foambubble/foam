import { readFile } from 'node:fs/promises';
import {
  Foam,
  FoamGraph,
  FoamWorkspace,
  LoadedQuery,
  Query,
  QueryStore,
  URI,
  executeQuery,
  uriToWorkspacePath,
} from '@foam/core';
import {
  parseArgs,
  getString,
  getFlag,
  resolveWorkspaceDir,
} from '../support/args';
import type { CliLogger, Format } from '../support/types';
import { loadWorkspaceFromDirectory } from '../support/filesystem';
import { createNodeQueryStore } from '../support/node-query-store';
import { dim, path as pathColor } from '../support/colors';

// ─── Help ─────────────────────────────────────────────────────────────────────

export const QUERY_HELP = `Usage: foam query <subcommand> [options]

Manage saved queries (a.k.a. Smart Folders in VS Code). Saved queries live as
YAML files under .foam/queries/ in your workspace.

Subcommands:
  list                  List all saved queries
  run <id>              Run a saved query and print matching notes
  show <id>             Print the YAML body of a saved query

Common options:
  --workspace <dir>     Workspace root (default: FOAM_WORKSPACE env var, then cwd)
  --format <fmt>        Output: text (default) or json
  --help                Show this help
`;

// ─── list ─────────────────────────────────────────────────────────────────────

function formatListText(
  workspace: FoamWorkspace,
  graph: FoamGraph,
  queries: LoadedQuery[]
): string {
  if (queries.length === 0) {
    return '';
  }
  return queries
    .map(loaded => {
      const matchCount = countMatches(loaded.query, workspace, graph);
      const desc = loaded.query.description
        ? ` ${dim('—')} ${loaded.query.description}`
        : '';
      return `${pathColor(loaded.query.id)} ${dim(`(${matchCount})`)}  ${loaded.query.name}${desc}`;
    })
    .join('\n');
}

function countMatches(
  query: Query,
  workspace: FoamWorkspace,
  graph: FoamGraph
): number {
  try {
    const { results } = executeQuery(query.descriptor, workspace, graph, {
      trusted: false,
    });
    return results.length;
  } catch {
    return 0;
  }
}

// ─── run ──────────────────────────────────────────────────────────────────────

function formatRunText(
  workspace: FoamWorkspace,
  uris: URI[]
): string {
  return uris.map(u => pathColor(uriToWorkspacePath(u, workspace))).join('\n');
}

// ─── show ─────────────────────────────────────────────────────────────────────

function readQueryFile(uri: URI): Promise<string> {
  return readFile(uri.toFsPath(), 'utf8');
}

// ─── Command runner ───────────────────────────────────────────────────────────

export async function runQueryCommand(
  argv: string[],
  logger: CliLogger
): Promise<number> {
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    logger.info(QUERY_HELP);
    return argv.length === 0 ? 1 : 0;
  }

  const [subcommand, ...rest] = argv;
  const parsed = parseArgs(rest);

  if (getFlag(parsed, 'help')) {
    logger.info(QUERY_HELP);
    return 0;
  }

  const format: Format = (getString(parsed, 'format') as Format) ?? 'text';
  const workspaceDir = resolveWorkspaceDir(parsed);

  try {
    const { foam, rootUri } = await loadWorkspaceFromDirectory(workspaceDir);
    const store = createNodeQueryStore(rootUri);

    switch (subcommand) {
      case 'list':
        return runList(foam, store, logger, format);
      case 'run':
        return runRun(foam, store, parsed, logger, format);
      case 'show':
        return runShow(store, parsed, logger);
      default:
        logger.error(`Unknown subcommand "${subcommand}".\n\n${QUERY_HELP}`);
        return 1;
    }
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
}

async function runList(
  foam: Foam,
  store: QueryStore,
  logger: CliLogger,
  format: Format
): Promise<number> {
  const queries = await store.loadAll();
  if (format === 'json') {
    const out = queries.map(loaded => ({
      id: loaded.query.id,
      name: loaded.query.name,
      description: loaded.query.description,
      matchCount: countMatches(loaded.query, foam.workspace, foam.graph),
      errors: loaded.errors,
    }));
    logger.info(JSON.stringify(out, null, 2));
  } else {
    const text = formatListText(foam.workspace, foam.graph, queries);
    if (text) logger.info(text);
  }
  return 0;
}

async function runRun(
  foam: Foam,
  store: QueryStore,
  parsed: ReturnType<typeof parseArgs>,
  logger: CliLogger,
  format: Format
): Promise<number> {
  const id = parsed.positionals[0];
  if (!id) {
    logger.error('Usage: foam query run <id>');
    return 1;
  }
  const loaded = await store.load(store.getFileUri(id));
  if (!loaded) {
    logger.error(`Saved query "${id}" not found.`);
    return 1;
  }

  const { results, warnings } = executeQuery(
    loaded.query.descriptor,
    foam.workspace,
    foam.graph,
    { trusted: false }
  );
  for (const w of warnings) logger.error(w);

  const uris = results.map(r => r.uri);
  if (format === 'json') {
    logger.info(
      JSON.stringify(
        uris.map(u => ({
          uri: u.toString(),
          path: uriToWorkspacePath(u, foam.workspace),
        })),
        null,
        2
      )
    );
  } else {
    const text = formatRunText(foam.workspace, uris);
    if (text) logger.info(text);
  }
  return 0;
}

async function runShow(
  store: QueryStore,
  parsed: ReturnType<typeof parseArgs>,
  logger: CliLogger
): Promise<number> {
  const id = parsed.positionals[0];
  if (!id) {
    logger.error('Usage: foam query show <id>');
    return 1;
  }
  if (!(await store.exists(id))) {
    logger.error(`Saved query "${id}" not found.`);
    return 1;
  }
  const body = await readQueryFile(store.getFileUri(id));
  logger.info(body.trimEnd());
  return 0;
}
