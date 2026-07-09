import {
  type ILogger,
  type ITelemetryReporter,
  Logger,
  LogLevel,
  BaseLogger,
  NoopTelemetryReporter,
  TELEMETRY_CONNECTION_STRING,
} from '@foam/core';
import { parseExportCommandArgs, renderExportHelp, runExportCommand } from './commands/export';
import { runListCommand } from './commands/list';
import { runNoteCommand } from './commands/note';
import { runLinksCommand } from './commands/links';
import { runGraphCommand } from './commands/graph';
import { runOutlineCommand } from './commands/outline';
import { runDailyCommand } from './commands/daily';
import { runLintCommand } from './commands/lint';
import { runGrepCommand } from './commands/grep';
import { runSearchCommand } from './commands/search';
import { runQueryCommand } from './commands/query';
import { runRenameCommand } from './commands/rename';
import { runTagCommand } from './commands/tag';
import { runUpdateCommand } from './commands/update';
import { parseMcpArgs, MCP_HELP, runMcpCommand } from './commands/mcp';
import { runConfigCommand } from './commands/config';
import { checkForUpdateNotice, getCurrentVersion } from './support/version';
import { setColorsEnabled } from './support/colors';
import {
  CommandRunResult,
  shouldSkipTelemetry,
  withTelemetry,
} from './support/with-telemetry';
import { resolveCliReporter } from './support/resolve-reporter';
import { AppInsightsReporter, httpsPoster } from './support/telemetry-reporter';
import { getCoreVersion } from './support/version';

const CLI_HELP = `Usage: foam <command> [options]

Commands:
  lint        Check workspace for issues
  list        List notes, tags, orphans, placeholders, deadends, or templates
  note        Show, create, move, delete, or get the id of a note
  outline     Show the heading structure of a note
  links       Show links to/from a note (alias: connections)
  graph       Export the workspace link graph as JSON
  daily       Show or create the daily note for a date
  tag         List, rename, or search tags
  grep        Search note content (grep-style, no graph needed)
  search      Search by title, alias, tag, or frontmatter property
  rename      Rename a note, tag, section, or block anchor (with link rewriting)
  query       List, run, or show saved queries (a.k.a. Smart Folders)
  mcp         Run an MCP server (Model Context Protocol) over stdio for AI agents
  update      Check for updates and show the install command
  config      Manage user-level Foam configuration (~/.config/foam/config.json)

Global options:
  --workspace <dir>   Workspace root (default: FOAM_WORKSPACE env var, then cwd)
  --format <fmt>      Output format: text (default) or json
  --color             Force colored output (overrides TTY detection)
  --no-color          Disable colored output
  --help              Show help
  --version, -v       Show foam-cli version

Run "foam <command> --help" for command-specific help.
`;

export type { ILogger as CliLogger } from '@foam/core';

export function renderCliHelp() {
  return CLI_HELP;
}

function hasJsonFormat(argv: string[]): boolean {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--format=json') return true;
    if (a === '--format' && argv[i + 1] === 'json') return true;
  }
  return false;
}

class ConsoleLogger extends BaseLogger {
  log(level: LogLevel, msg?: string, ...params: any[]): void {
    const formattedMsg = level === 'info' ? msg : `[${level}] ${msg}`;
    console[level](formattedMsg, ...params);
  }
}

/**
 * Entrypoint usable in-process. Production binary calls this from `main()`
 * with a real {@link AppInsightsReporter}; tests omit `reporter` and get
 * {@link NoopTelemetryReporter} — the safe default that never POSTs.
 */
export async function runCli(
  argv: string[],
  logger: ILogger = new ConsoleLogger(),
  reporter: ITelemetryReporter = NoopTelemetryReporter
): Promise<number> {
  const [command, ...commandArgs] = argv;

  const isJsonOutput = hasJsonFormat(argv);

  // Configure colors: --no-color and --color override env/TTY auto-detection,
  // and JSON output always disables colors so machine consumers get clean output.
  if (argv.includes('--no-color') || isJsonOutput) {
    setColorsEnabled(false);
  } else if (argv.includes('--color')) {
    setColorsEnabled(true);
  }

  // Compute the update notice up front (reads cache + writes lastNotified),
  // but defer printing until after the command output so the notice doesn't
  // push the user's actual output off-screen.
  // Suppressed for the update command itself, JSON output, and non-TTY environments.
  // Rate-limited inside checkForUpdateNotice() (at most once per 24h).
  const updateNotice =
    command !== 'update' && !isJsonOutput && process.stdout.isTTY
      ? checkForUpdateNotice()
      : null;

  const exitCode = shouldSkipTelemetry(command, commandArgs)
    ? toExitCode(await dispatch(command, commandArgs, logger))
    : await withTelemetry({
        command: command!,
        reporter,
        run: effectiveReporter =>
          dispatch(command, commandArgs, logger, effectiveReporter),
      });

  if (updateNotice) logger.info(updateNotice);
  return exitCode;
}

function toExitCode(result: CommandRunResult): number {
  return typeof result === 'number' ? result : result.exitCode;
}

async function dispatch(
  command: string | undefined,
  commandArgs: string[],
  logger: ILogger,
  reporter: ITelemetryReporter = NoopTelemetryReporter
): Promise<CommandRunResult> {
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    logger.info(renderCliHelp());
    return 0;
  }

  if (command === '--version' || command === '-v') {
    logger.info(getCurrentVersion());
    return 0;
  }

  try {
    switch (command) {
      case 'export': {
        if (commandArgs.includes('--help') || commandArgs.includes('-h')) {
          logger.info(renderExportHelp());
          return 0;
        }

        await runExportCommand(parseExportCommandArgs(commandArgs));
        return 0;
      }
      case 'lint': {
        return runLintCommand(commandArgs, logger);
      }
      case 'list': {
        return runListCommand(commandArgs, logger);
      }
      case 'note': {
        return runNoteCommand(commandArgs, logger);
      }
      case 'outline': {
        return runOutlineCommand(commandArgs, logger);
      }
      case 'links':
      case 'connections': {
        return runLinksCommand(commandArgs, logger);
      }
      case 'graph': {
        return runGraphCommand(commandArgs, logger);
      }
      case 'daily': {
        return runDailyCommand(commandArgs, logger);
      }
      case 'tag': {
        return runTagCommand(commandArgs, logger);
      }
      case 'grep': {
        return runGrepCommand(commandArgs, logger);
      }
      case 'search': {
        return runSearchCommand(commandArgs, logger);
      }
      case 'query': {
        return runQueryCommand(commandArgs, logger);
      }
      case 'rename': {
        return runRenameCommand(commandArgs, logger);
      }
      case 'update': {
        return runUpdateCommand(commandArgs, logger);
      }
      case 'mcp': {
        if (commandArgs.includes('--help') || commandArgs.includes('-h')) {
          logger.info(MCP_HELP);
          return 0;
        }
        // The MCP server is long-lived so opt the fork into auto-flushing
        return runMcpCommand(
          parseMcpArgs(commandArgs),
          logger,
          reporter.forComponent('mcp', { autoFlush: { maxQueueSize: 10 } })
        );
      }
      case 'config': {
        return runConfigCommand(commandArgs, logger);
      }
      default:
        logger.error(`Unknown command "${command}".\n\n${renderCliHelp()}`);
        return 1;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    logger.error(message);
    if (process.env.FOAM_DEBUG && stack) logger.error(stack);
    // Surface the failure structurally so `cli.command-invoked` records what
    // went wrong. Without this, every caught command failure looks identical
    // (`exitCode=1`) in telemetry — the actual failure mode is invisible.
    const errorType =
      error instanceof Error ? error.constructor.name : 'UnknownError';
    return {
      exitCode: 1,
      telemetryProperties: { errorType, errorContext: 'dispatch' },
    };
  }
}

async function main() {
  Logger.setLevel('info');
  const argv = process.argv.slice(2);
  const [command, ...commandArgs] = argv;

  // Production opt-in: this is the single place that resolves consent and
  // wires the real reporter. Other callers of `runCli` (tests, embeddings)
  // pass a noop directly. The factory only runs if telemetry is effectively
  // enabled, so we don't construct a real reporter when the user opted out.
  const reporter = await resolveCliReporter({
    command,
    commandArgs,
    buildReporter: installationId =>
      new AppInsightsReporter({
        connectionString: TELEMETRY_CONNECTION_STRING,
        component: 'cli',
        componentVersion: getCurrentVersion(),
        coreVersion: getCoreVersion(),
        poster: httpsPoster,
        installationId,
      }),
  });

  const exitCode = await runCli(argv, undefined, reporter);
  process.exitCode = exitCode;
}

if (require.main === module) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
