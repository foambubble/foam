import fs from 'node:fs/promises';
import path from 'node:path';

import {
  URI,
  getDailyNoteTemplateCandidateUris,
  getTemplatesDir,
  resolveDailyNote,
} from '@foam/core';
import { loadWorkspaceFromDirectory } from '../support/filesystem';
import {
  parseArgs,
  getString,
  getFlag,
  resolveWorkspaceDir,
} from '../support/args';
import type { CliLogger, Format } from '../support/types';

// ─── Help ─────────────────────────────────────────────────────────────────────

export const DAILY_HELP = `Usage: foam daily [options]

Show or create the daily note for a date.

Options:
  --date <YYYY-MM-DD>  Date (default: today)
  --create             Create the note if it doesn't exist
  --path-only          Print only the resolved path (for scripting)
  --workspace <dir>    Workspace root (default: FOAM_WORKSPACE env var, then cwd)
  --format <fmt>       text (default) or json
  --help               Show this help
`;

// Default path pattern when no template: journals/YYYY-MM-DD.md
const DEFAULT_JOURNALS_DIR = 'journals';

// ─── Domain ───────────────────────────────────────────────────────────────────

export function parseDateArg(dateStr: string | undefined): Date {
  if (!dateStr) return new Date();
  const d = new Date(dateStr + 'T00:00:00'); // local midnight
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date "${dateStr}". Expected YYYY-MM-DD.`);
  }
  return d;
}

export function defaultDailyNotePath(date: Date, rootDir: string): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const filename = `${y}-${m}-${d}.md`;
  return path.join(rootDir, DEFAULT_JOURNALS_DIR, filename);
}

/**
 * Resolve the daily note path using the template if one exists,
 * otherwise fall back to journals/YYYY-MM-DD.md.
 */
export async function resolveDailyNotePath(
  date: Date,
  rootDir: string,
  foam: Awaited<ReturnType<typeof loadWorkspaceFromDirectory>>['foam'],
  dataStore: Awaited<ReturnType<typeof loadWorkspaceFromDirectory>>['dataStore']
): Promise<string> {
  const templatesDir = getTemplatesDir(rootDir);
  const candidates = getDailyNoteTemplateCandidateUris(templatesDir);

  const fallbackPath = defaultDailyNotePath(date, rootDir);
  const fallbackUri = URI.file(fallbackPath);

  for (const templateUri of candidates) {
    const content = await dataStore.read(templateUri);
    if (content === null) continue;

    // Template exists — use it to derive the filepath
    const result = await resolveDailyNote(date, templateUri, foam, async uri => {
      const text = await dataStore.read(uri);
      return text ?? '';
    }, { fallbackFilepath: fallbackUri });

    return foam.workspace.resolveUri(result.filepath.path).toFsPath();
  }

  // No template found — use default path
  return fallbackPath;
}

// ─── Command runner ───────────────────────────────────────────────────────────

export async function runDailyCommand(
  argv: string[],
  logger: CliLogger
): Promise<number> {
  const parsed = parseArgs(argv);

  if (getFlag(parsed, 'help') || argv[0] === '--help' || argv[0] === '-h') {
    logger.info(DAILY_HELP);
    return 0;
  }

  const format: Format = (getString(parsed, 'format') as Format) ?? 'text';
  const workspaceDir = resolveWorkspaceDir(parsed);
  const dateStr = getString(parsed, 'date');
  const shouldCreate = getFlag(parsed, 'create');
  const pathOnly = getFlag(parsed, 'path-only');

  try {
    const date = parseDateArg(dateStr);
    const { rootDir, foam, dataStore, workspace } =
      await loadWorkspaceFromDirectory(workspaceDir);

    const notePath = await resolveDailyNotePath(date, rootDir, foam, dataStore);

    let exists = false;
    try {
      await fs.access(notePath);
      exists = true;
    } catch {
      exists = false;
    }

    if (shouldCreate && !exists) {
      // Find the template to get content, then write
      const templatesDir = getTemplatesDir(rootDir);
      const candidates = getDailyNoteTemplateCandidateUris(templatesDir);
      let content = `# ${formatDateTitle(date)}\n`;

      for (const templateUri of candidates) {
        const templateContent = await dataStore.read(templateUri);
        if (templateContent === null) continue;
        const result = await resolveDailyNote(date, templateUri, foam, async uri => {
          const text = await dataStore.read(uri);
          return text ?? '';
        }, { fallbackFilepath: URI.file(notePath) });
        content = result.content;
        break;
      }

      await fs.mkdir(path.dirname(notePath), { recursive: true });
      await fs.writeFile(notePath, content, 'utf8');
      exists = true;
    }

    const relPath = path.relative(rootDir, notePath);

    // Get the Foam identifier if the note exists in the workspace
    const noteUri = URI.file(notePath);
    const resource = workspace.find(noteUri);
    const id = resource ? workspace.getIdentifier(noteUri) : path.basename(notePath, '.md');

    if (pathOnly) {
      logger.info(notePath);
      return 0;
    }

    if (format === 'json') {
      logger.info(JSON.stringify({ id, uri: notePath, exists }, null, 2));
    } else {
      const status = exists ? '[exists]' : '[does not exist]';
      logger.info(`${relPath}  ${status}`);
    }

    return 0;
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTitle(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
