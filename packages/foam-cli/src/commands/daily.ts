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
import type { CommandRunResult } from '../support/with-telemetry';
import { dim, path as pathColor, success } from '../support/colors';

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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`Invalid date "${dateStr}". Expected YYYY-MM-DD.`);
  }
  const d = new Date(dateStr + 'T00:00:00'); // local midnight
  const pad = (n: number) => String(n).padStart(2, '0');
  const roundtrip = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (roundtrip !== dateStr) {
    throw new Error(`Invalid date "${dateStr}" (did you mean ${roundtrip}?). Expected YYYY-MM-DD.`);
  }
  return d;
}

export function defaultDailyNoteUri(date: Date, rootUri: URI): URI {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const filename = `${y}-${m}-${d}.md`;
  return rootUri.joinPath(DEFAULT_JOURNALS_DIR, filename);
}

/**
 * Resolve the daily note URI using the template if one exists,
 * otherwise fall back to journals/YYYY-MM-DD.md.
 */
export async function resolveDailyNoteUri(
  date: Date,
  rootUri: URI,
  foam: Awaited<ReturnType<typeof loadWorkspaceFromDirectory>>['foam'],
  dataStore: Awaited<ReturnType<typeof loadWorkspaceFromDirectory>>['dataStore']
): Promise<URI> {
  const templatesDir = getTemplatesDir(rootUri);
  const candidates = getDailyNoteTemplateCandidateUris(templatesDir);

  const fallbackUri = defaultDailyNoteUri(date, rootUri);

  for (const templateUri of candidates) {
    const content = await dataStore.read(templateUri);
    if (content === null) continue;

    // Template exists — use it to derive the filepath
    const result = await resolveDailyNote(date, templateUri, foam, async uri => {
      const text = await dataStore.read(uri);
      return text ?? '';
    }, { fallbackFilepath: fallbackUri });

    return foam.workspace.resolveUri(result.filepath.path);
  }

  // No template found — use default path
  return fallbackUri;
}

// ─── Command runner ───────────────────────────────────────────────────────────

export async function runDailyCommand(
  argv: string[],
  logger: CliLogger
): Promise<CommandRunResult> {
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
    const { rootDir, rootUri, foam, dataStore, workspace } =
      await loadWorkspaceFromDirectory(workspaceDir);

    const noteUri = await resolveDailyNoteUri(date, rootUri, foam, dataStore);
    const notePath = noteUri.toFsPath();

    let exists = await dataStore.exists(noteUri);
    // Telemetry state: we want to distinguish four scenarios on
    // `cli.command-invoked`:
    //   1. read-only lookup (`--create` not passed, or note already existed)
    //   2. created a new note using the user's daily-note template
    //   3. created a new note from the built-in `# title` fallback (no template)
    // `mode` reflects what actually happened (did we write a file this run),
    // not the user's intent — `--create` against an existing note resolves
    // to `open` because nothing was written.
    let wroteFile = false;
    let appliedTemplate: URI | undefined;

    if (shouldCreate && !exists) {
      // Find the template to get content, then write
      const templatesDir = getTemplatesDir(rootUri);
      const candidates = getDailyNoteTemplateCandidateUris(templatesDir);
      let content = `# ${formatDateTitle(date)}\n`;

      for (const templateUri of candidates) {
        const templateContent = await dataStore.read(templateUri);
        if (templateContent === null) continue;
        const result = await resolveDailyNote(date, templateUri, foam, async uri => {
          const text = await dataStore.read(uri);
          return text ?? '';
        }, { fallbackFilepath: noteUri });
        content = result.content;
        appliedTemplate = templateUri;
        break;
      }

      await dataStore.write(noteUri, content);
      exists = true;
      wroteFile = true;
    }

    const relPath = path.relative(rootDir, notePath);

    // Get the Foam identifier if the note exists in the workspace
    const resource = workspace.find(noteUri);
    const id = resource
      ? workspace.getIdentifier(noteUri)
      : path.basename(notePath, '.md');

    if (pathOnly) {
      logger.info(notePath);
      return { exitCode: 0, telemetryProperties: buildTelemetryProperties(wroteFile, appliedTemplate) };
    }

    if (format === 'json') {
      logger.info(JSON.stringify({ id, uri: notePath, exists }, null, 2));
    } else {
      const status = exists ? success('[exists]') : dim('[does not exist]');
      logger.info(`${pathColor(relPath)}  ${status}`);
    }

    return { exitCode: 0, telemetryProperties: buildTelemetryProperties(wroteFile, appliedTemplate) };
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
}

/**
 * Builds the `cli.command-invoked` extras for `daily`.
 *
 * Always emits `mode`: `create` when this invocation wrote a new daily
 * note, `open` otherwise (read-only lookup, or `--create` against an
 * existing note where nothing was written).
 *
 * When `mode === 'create'` and a user-configured daily-note template was
 * applied, also emits `template-type: 'daily-note'` and `template-format`
 * derived from the template extension. Omits the template-* pair on the
 * built-in `# title` fallback path (same as in `note create`).
 */
function buildTelemetryProperties(
  wroteFile: boolean,
  appliedTemplate: URI | undefined
): Record<string, string> {
  const props: Record<string, string> = {
    mode: wroteFile ? 'create' : 'open',
  };
  if (wroteFile && appliedTemplate) {
    const fsPath = appliedTemplate.toFsPath();
    props['template-type'] = 'daily-note';
    props['template-format'] = fsPath.endsWith('.js') ? 'js' : 'md';
  }
  return props;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTitle(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
