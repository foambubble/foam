import path from 'node:path';
import { FoamGraph, FoamWorkspace } from '@foam/core';
import { loadWorkspaceFromDirectory } from '../support/filesystem';
import {
  parseArgs,
  getString,
  getFlag,
  resolveWorkspaceDir,
} from '../support/args';
import type { CliLogger, Format } from '../support/types';
import { resolveNote } from '../support/workspace';

// ─── Help ─────────────────────────────────────────────────────────────────────

export const LINKS_HELP = `Usage: foam links <identifier> [options]

Show links to/from a note. Alias: foam connections

Options:
  --path <path>        Target by exact path instead of identifier resolution
  --outgoing           Show only outgoing links
  --incoming           Show only incoming links
  --workspace <dir>    Workspace root (default: FOAM_WORKSPACE env var, then cwd)
  --format <fmt>       text (default) or json
  --help               Show this help
`;

// ─── Domain ───────────────────────────────────────────────────────────────────

export function linksData(
  workspace: InstanceType<typeof FoamWorkspace>,
  graph: InstanceType<typeof FoamGraph>,
  identifier: string | undefined,
  pathFlag: string | undefined,
  rootDir: string
) {
  const resource = resolveNote(workspace, identifier, pathFlag);
  const id = workspace.getIdentifier(resource.uri);

  const outgoing = graph.getLinks(resource.uri).map(c => {
    const target = workspace.find(c.target);
    return {
      id: workspace.getIdentifier(c.target),
      uri: c.target.toFsPath(),
      path: path.relative(rootDir, c.target.toFsPath()),
      title: target?.title ?? '',
      label: c.link.rawText,
    };
  });

  const incoming = graph.getBacklinks(resource.uri).map(c => {
    const source = workspace.find(c.source);
    return {
      id: workspace.getIdentifier(c.source),
      uri: c.source.toFsPath(),
      path: path.relative(rootDir, c.source.toFsPath()),
      title: source?.title ?? '',
      label: c.link.rawText,
    };
  });

  return {
    id,
    uri: resource.uri.toFsPath(),
    outgoing,
    incoming,
  };
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatLinksText(
  data: ReturnType<typeof linksData>,
  opts: { outgoing: boolean; incoming: boolean }
): string {
  const lines: string[] = [];

  if (opts.outgoing) {
    lines.push(`Outgoing (${data.outgoing.length}):`);
    if (data.outgoing.length === 0) {
      lines.push('  (none)');
    } else {
      const maxId = Math.max(...data.outgoing.map(c => c.id.length));
      for (const c of data.outgoing) {
        lines.push(`  → ${c.id.padEnd(maxId + 2)}${c.path}`);
      }
    }
  }

  if (opts.outgoing && opts.incoming) {
    lines.push('');
  }

  if (opts.incoming) {
    lines.push(`Incoming (${data.incoming.length}):`);
    if (data.incoming.length === 0) {
      lines.push('  (none)');
    } else {
      const maxId = Math.max(...data.incoming.map(c => c.id.length));
      for (const c of data.incoming) {
        lines.push(`  ← ${c.id.padEnd(maxId + 2)}${c.path}`);
      }
    }
  }

  return lines.join('\n');
}

// ─── Command runner ───────────────────────────────────────────────────────────

export async function runLinksCommand(
  argv: string[],
  logger: CliLogger
): Promise<number> {
  const [first, ...rest] = argv;

  if (!first || first === '--help' || first === '-h') {
    logger.info(LINKS_HELP);
    return 0;
  }

  // first could be the identifier or a flag — detect by leading '--'
  const isFlag = first.startsWith('--');
  const identifier = isFlag ? undefined : first;
  const parsed = parseArgs(isFlag ? argv : rest);

  if (getFlag(parsed, 'help')) {
    logger.info(LINKS_HELP);
    return 0;
  }

  const format: Format = (getString(parsed, 'format') as Format) ?? 'text';
  const workspaceDir = resolveWorkspaceDir(parsed);
  const pathFlag = getString(parsed, 'path');
  const onlyOutgoing = getFlag(parsed, 'outgoing');
  const onlyIncoming = getFlag(parsed, 'incoming');

  // Default: show both
  const showOutgoing = onlyOutgoing || (!onlyOutgoing && !onlyIncoming);
  const showIncoming = onlyIncoming || (!onlyOutgoing && !onlyIncoming);

  if (!identifier && !pathFlag) {
    logger.error('Provide a note identifier or --path <path>.\n\n' + LINKS_HELP);
    return 1;
  }

  try {
    const { rootDir, workspace } = await loadWorkspaceFromDirectory(workspaceDir);
    const graph = FoamGraph.fromWorkspace(workspace);
    const data = linksData(workspace, graph, identifier, pathFlag, rootDir);

    if (format === 'json') {
      const output: any = { id: data.id, uri: data.uri };
      if (showOutgoing) output.outgoing = data.outgoing;
      if (showIncoming) output.incoming = data.incoming;
      logger.info(JSON.stringify(output, null, 2));
    } else {
      logger.info(formatLinksText(data, { outgoing: showOutgoing, incoming: showIncoming }));
    }
    return 0;
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
}
