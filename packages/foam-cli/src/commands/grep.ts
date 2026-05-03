import fs from 'node:fs/promises';
import path from 'node:path';
import {
  parseArgs,
  getString,
  getFlag,
  resolveWorkspaceDir,
} from '../support/args';
import type { CliLogger, Format } from '../support/types';
import { loadWorkspaceFromDirectory } from '../support/filesystem';

// ─── Help ─────────────────────────────────────────────────────────────────────

export const GREP_HELP = `Usage: foam grep <pattern> [options]

Search note content (no workspace graph needed).

Options:
  --context <n>         Show n lines of surrounding context around each match
  --no-line-number      Omit line numbers from output
  --limit <n>           Max matching files (default: 20)
  --workspace <dir>     Workspace root (default: FOAM_WORKSPACE env var, then cwd)
  --format <fmt>        text (default) or json
  --help                Show this help
`;

// ─── Domain ───────────────────────────────────────────────────────────────────

export interface GrepMatch {
  uri: string;
  line: number;
  text: string;
  context_before?: string[];
  context_after?: string[];
}

export interface GrepOptions {
  limit?: number;
  context?: number;
}

/**
 * Search a list of file paths for lines matching the given pattern.
 * Callers are responsible for providing the file list — use the workspace
 * dataStore to ensure the same resources are searched as the workspace indexes.
 */
export async function grepFiles(
  files: string[],
  pattern: string,
  opts: GrepOptions = {}
): Promise<GrepMatch[]> {
  const limit = opts.limit ?? 20;
  const context = opts.context ?? 0;
  const regex = new RegExp(pattern, 'i');
  const results: GrepMatch[] = [];
  let matchedFiles = 0;

  for (const file of files) {
    if (matchedFiles >= limit) break;

    let content: string;
    try {
      content = await fs.readFile(file, 'utf8');
    } catch {
      continue;
    }

    const lines = content.split('\n');
    // Remove trailing empty line from split
    if (lines[lines.length - 1] === '') lines.pop();

    let fileMatched = false;
    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        fileMatched = true;
        const match: GrepMatch = {
          uri: file,
          line: i + 1,
          text: lines[i],
        };
        if (context > 0) {
          match.context_before = lines.slice(Math.max(0, i - context), i);
          match.context_after = lines.slice(i + 1, i + 1 + context);
        }
        results.push(match);
      }
    }
    if (fileMatched) matchedFiles++;
  }

  return results;
}

// ─── Formatting ───────────────────────────────────────────────────────────────

export function formatGrepText(
  matches: GrepMatch[],
  workspaceDir: string,
  opts: { noLineNumber?: boolean; context?: number }
): string {
  if (matches.length === 0) return '';

  const lines: string[] = [];
  const context = opts.context ?? 0;
  let prevUri: string | null = null;
  let prevMatchLine = -Infinity;

  for (const match of matches) {
    const rel = path.relative(workspaceDir, match.uri);

    if (context > 0) {
      // Separator between match groups
      if (prevUri !== null && (prevUri !== match.uri || match.line > prevMatchLine + context * 2 + 1)) {
        lines.push('--');
      }

      for (const ctxLine of match.context_before ?? []) {
        const ctxLineNum = match.line - (match.context_before!.length - (match.context_before!.indexOf(ctxLine)));
        lines.push(`${rel}-${ctxLineNum}- ${ctxLine}`);
      }
    }

    if (opts.noLineNumber) {
      lines.push(`${rel}: ${match.text}`);
    } else {
      lines.push(`${rel}:${match.line}: ${match.text}`);
    }

    if (context > 0) {
      for (let i = 0; i < (match.context_after ?? []).length; i++) {
        lines.push(`${rel}-${match.line + 1 + i}- ${match.context_after![i]}`);
      }
    }

    prevUri = match.uri;
    prevMatchLine = match.line;
  }

  return lines.join('\n');
}

// ─── Command runner ───────────────────────────────────────────────────────────

export async function runGrepCommand(
  argv: string[],
  logger: CliLogger
): Promise<number> {
  const [first, ...rest] = argv;

  if (!first || first === '--help' || first === '-h') {
    if (!first) {
      logger.error('Missing required pattern argument.\n\n' + GREP_HELP);
      return 1;
    }
    logger.info(GREP_HELP);
    return 0;
  }

  const isFlag = first.startsWith('--');
  const pattern = isFlag ? undefined : first;
  const parsed = parseArgs(isFlag ? argv : rest);

  if (getFlag(parsed, 'help')) {
    logger.info(GREP_HELP);
    return 0;
  }

  if (!pattern) {
    logger.error('Missing required pattern argument.\n\n' + GREP_HELP);
    return 1;
  }

  const format: Format = (getString(parsed, 'format') as Format) ?? 'text';
  const workspaceDir = resolveWorkspaceDir(parsed);
  const noLineNumber = getFlag(parsed, 'no-line-number');
  const contextN = parseInt(getString(parsed, 'context') ?? '0', 10);
  const limit = parseInt(getString(parsed, 'limit') ?? '20', 10);

  try {
    const { dataStore } = await loadWorkspaceFromDirectory(workspaceDir);
    const uris = await dataStore.list();
    const files = uris.map(u => u.toFsPath());
    const matches = await grepFiles(files, pattern, {
      limit: isNaN(limit) ? 20 : limit,
      context: isNaN(contextN) ? 0 : contextN,
    });

    if (format === 'json') {
      const output = matches.map(m => {
        const entry: any = { uri: m.uri, line: m.line, text: m.text };
        if (contextN > 0) {
          entry.context_before = m.context_before ?? [];
          entry.context_after = m.context_after ?? [];
        }
        return entry;
      });
      if (output.length > 0) logger.info(JSON.stringify(output, null, 2));
    } else {
      const text = formatGrepText(matches, workspaceDir, {
        noLineNumber,
        context: contextN,
      });
      if (text) logger.info(text);
    }

    return 0;
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
}
