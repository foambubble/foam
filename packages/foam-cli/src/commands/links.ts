import {
  FoamGraph,
  FoamWorkspace,
  linksData,
  resolveNote,
  uriToWorkspacePath,
} from '@foam/core';
import { loadWorkspaceFromDirectory } from '../support/filesystem';
import { serializeLinkEntry } from '../support/serializers';
import {
  parseArgs,
  getString,
  getFlag,
  resolveWorkspaceDir,
  noteRefFromCliArgs,
} from '../support/args';
import type { CliLogger, Format } from '../support/types';
import { bold, dim, path as pathColor } from '../support/colors';

// Re-export domain function
export { linksData } from '@foam/core';

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

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatLinksText(
  data: ReturnType<typeof linksData>,
  workspace: FoamWorkspace,
  opts: { outgoing: boolean; incoming: boolean }
): string {
  const lines: string[] = [];

  const padAndColorId = (id: string, totalWidth: number) => {
    const padding = ' '.repeat(Math.max(0, totalWidth - id.length));
    return `${pathColor(id)}${padding}`;
  };

  if (opts.outgoing) {
    lines.push(`${bold('Outgoing')} ${dim(`(${data.outgoing.length}):`)}`);
    if (data.outgoing.length === 0) {
      lines.push(`  ${dim('(none)')}`);
    } else {
      const maxId = Math.max(...data.outgoing.map(c => c.id.length));
      for (const c of data.outgoing) {
        const p = uriToWorkspacePath(c.uri, workspace);
        lines.push(`  ${dim('→')} ${padAndColorId(c.id, maxId + 2)}${dim(p)}`);
      }
    }
  }

  if (opts.outgoing && opts.incoming) {
    lines.push('');
  }

  if (opts.incoming) {
    lines.push(`${bold('Incoming')} ${dim(`(${data.incoming.length}):`)}`);
    if (data.incoming.length === 0) {
      lines.push(`  ${dim('(none)')}`);
    } else {
      const maxId = Math.max(...data.incoming.map(c => c.id.length));
      for (const c of data.incoming) {
        const p = uriToWorkspacePath(c.uri, workspace);
        lines.push(`  ${dim('←')} ${padAndColorId(c.id, maxId + 2)}${dim(p)}`);
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
    const { rootDir, workspace } =
      await loadWorkspaceFromDirectory(workspaceDir);
    const ref = noteRefFromCliArgs(identifier, pathFlag, rootDir);
    const resource = resolveNote(workspace, ref);
    const graph = FoamGraph.fromWorkspace(workspace);
    const data = linksData(workspace, graph, resource);

    if (format === 'json') {
      const output: any = {
        id: data.id,
        uri: data.uri.toFsPath(),
        path: uriToWorkspacePath(data.uri, workspace),
      };
      if (showOutgoing)
        output.outgoing = data.outgoing.map(e =>
          serializeLinkEntry(e, workspace)
        );
      if (showIncoming)
        output.incoming = data.incoming.map(e =>
          serializeLinkEntry(e, workspace)
        );
      logger.info(JSON.stringify(output, null, 2));
    } else {
      logger.info(
        formatLinksText(data, workspace, {
          outgoing: showOutgoing,
          incoming: showIncoming,
        })
      );
    }
    return 0;
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
}
