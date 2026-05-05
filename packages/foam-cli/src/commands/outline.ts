import { FoamWorkspace } from '@foam/core';
import { loadWorkspaceFromDirectory } from '../support/filesystem';
import {
  parseArgs,
  getString,
  getFlag,
  resolveWorkspaceDir,
} from '../support/args';
import type { CliLogger, Format } from '../support/types';
import { resolveNote } from '../support/workspace';
import { dim } from '../support/colors';

// ─── Help ─────────────────────────────────────────────────────────────────────

export const OUTLINE_HELP = `Usage: foam outline <identifier> [options]

Show the heading structure of a note.

Options:
  --path <path>        Target by exact path instead of identifier resolution
  --workspace <dir>    Workspace root (default: FOAM_WORKSPACE env var, then cwd)
  --format <fmt>       text (default) or json
  --help               Show this help
`;

// ─── Domain ───────────────────────────────────────────────────────────────────

export function outlineData(
  workspace: InstanceType<typeof FoamWorkspace>,
  identifier: string | undefined,
  pathFlag: string | undefined,
  rootDir?: string
) {
  const resource = resolveNote(workspace, identifier, pathFlag, rootDir);
  const id = workspace.getIdentifier(resource.uri);

  return {
    id,
    uri: resource.uri.toFsPath(),
    sections: resource.sections.map(s => ({
      label: s.label,
      level: s.level,
      range: {
        start: { line: s.range.start.line, character: s.range.start.character },
        end: { line: s.range.end.line, character: s.range.end.character },
      },
    })),
  };
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatOutlineText(data: ReturnType<typeof outlineData>): string {
  if (data.sections.length === 0) return dim('(no headings)');
  return data.sections
    .map(s => {
      const indent = s.level === 1 ? '' : '  '.repeat(s.level - 1);
      return `${indent}${dim('#'.repeat(s.level))} ${s.label}`;
    })
    .join('\n');
}

// ─── Command runner ───────────────────────────────────────────────────────────

export async function runOutlineCommand(
  argv: string[],
  logger: CliLogger
): Promise<number> {
  const [first, ...rest] = argv;

  if (!first || first === '--help' || first === '-h') {
    logger.info(OUTLINE_HELP);
    return 0;
  }

  const isFlag = first.startsWith('--');
  const identifier = isFlag ? undefined : first;
  const parsed = parseArgs(isFlag ? argv : rest);

  if (getFlag(parsed, 'help')) {
    logger.info(OUTLINE_HELP);
    return 0;
  }

  const format: Format = (getString(parsed, 'format') as Format) ?? 'text';
  const workspaceDir = resolveWorkspaceDir(parsed);
  const pathFlag = getString(parsed, 'path');

  if (!identifier && !pathFlag) {
    logger.error('Provide a note identifier or --path <path>.\n\n' + OUTLINE_HELP);
    return 1;
  }

  try {
    const { workspace, rootDir } = await loadWorkspaceFromDirectory(workspaceDir);
    const data = outlineData(workspace, identifier, pathFlag, rootDir);

    if (format === 'json') {
      logger.info(JSON.stringify(data, null, 2));
    } else {
      logger.info(formatOutlineText(data));
    }
    return 0;
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
}
