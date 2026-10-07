import fs from 'node:fs';
import path from 'node:path';

import {
  Config,
  IFoamConfig,
  URI,
  asAbsoluteUri,
  dailyNoteSettings,
  getDailyNoteTemplateCandidateUris,
  getTemplatesDir,
  isWithinPath,
} from '@foam/core';
import { resolveDailyNote } from '@foam/core/scripting';
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

export interface DailyNote {
  uri: URI;
  /** What a new note would contain. */
  content: string;
  /** The daily-note template; `undefined` when the workspace has none. */
  templateUri?: URI;
}

/**
 * Resolve the daily note the way desktop Foam does: the template's
 * `filepath` when it has one, otherwise the `openDailyNote.*` settings,
 * otherwise `journal/YYYY-MM-DD.md`. Throws when that is outside the
 * workspace.
 */
export async function resolveDailyNoteFile(
  date: Date,
  rootUri: URI,
  foam: Awaited<ReturnType<typeof loadWorkspaceFromDirectory>>['foam'],
  dataStore: Awaited<ReturnType<typeof loadWorkspaceFromDirectory>>['dataStore'],
  config: IFoamConfig
): Promise<DailyNote> {
  let templateUri: URI | undefined;
  for (const candidate of getDailyNoteTemplateCandidateUris(getTemplatesDir(rootUri))) {
    if ((await dataStore.read(candidate)) !== null) {
      templateUri = candidate;
      break;
    }
  }

  const note = await resolveDailyNote(
    date,
    templateUri,
    foam,
    async uri => (await dataStore.read(uri)) ?? '',
    dailyNoteSettings(config),
    { locale: config.getDateLocale() }
  );
  const noteUri = asAbsoluteUri(note.filepath, foam.workspace.roots);

  // Both the template and the settings come from the workspace's own files.
  if (!(await isInsideWorkspace(noteUri.toFsPath(), rootUri.toFsPath()))) {
    throw new Error(
      `The daily note path ${noteUri.toFsPath()} is outside the workspace. ` +
        `Check foam.openDailyNote.directory and the daily note template's filepath.`
    );
  }
  return { uri: noteUri, content: note.content, templateUri };
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

  const date = parseDateArg(dateStr);
  const { rootDir, rootUri, foam, dataStore, workspace } =
    await loadWorkspaceFromDirectory(workspaceDir);

  const note = await resolveDailyNoteFile(date, rootUri, foam, dataStore, Config);
  const noteUri = note.uri;
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

  if (shouldCreate && !exists) {
    await dataStore.write(noteUri, note.content);
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
    return { exitCode: 0, telemetryProperties: buildTelemetryProperties(wroteFile, note.templateUri) };
  }

  if (format === 'json') {
    logger.info(JSON.stringify({ id, uri: notePath, exists }, null, 2));
  } else {
    const status = exists ? success('[exists]') : dim('[does not exist]');
    logger.info(`${pathColor(relPath)}  ${status}`);
  }

  return { exitCode: 0, telemetryProperties: buildTelemetryProperties(wroteFile, note.templateUri) };
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

/**
 * Whether `notePath` lies inside `rootDir` once `..` segments and symlinks are
 * resolved. A dangling symlink on the way counts as outside, since writing
 * through it would create its target wherever it points.
 */
async function isInsideWorkspace(
  notePath: string,
  rootDir: string
): Promise<boolean> {
  const isPresent = (p: string) =>
    fs.promises.lstat(p).then(
      () => true,
      () => false
    );
  let existing = path.resolve(notePath);
  const missing: string[] = [];
  while (!(await isPresent(existing))) {
    missing.unshift(path.basename(existing));
    existing = path.dirname(existing);
  }
  let realExisting: string;
  try {
    realExisting = await fs.promises.realpath(existing);
  } catch {
    return false;
  }
  return isWithinPath(
    URI.file(path.join(realExisting, ...missing)),
    URI.file(await fs.promises.realpath(rootDir))
  );
}
