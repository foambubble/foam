import { type ILogger, Logger, LogLevel, BaseLogger } from '@foam/core';
import { parsePublishCommandArgs, renderPublishHelp, runPublishCommand } from './commands/publish';
import { runListCommand } from './commands/list';
import { runNoteCommand } from './commands/note';
import { runLinksCommand } from './commands/links';
import { runOutlineCommand } from './commands/outline';
import { runDailyCommand } from './commands/daily';
import { runLintCommand } from './commands/lint';
import { runGrepCommand } from './commands/grep';
import { runSearchCommand } from './commands/search';
import { runRenameCommand } from './commands/rename';
import { runTagCommand } from './commands/tag';
import { runUpdateCommand } from './commands/update';
import { checkForUpdateNotice } from './support/version';

const CLI_HELP = `Usage: foam <command> [options]

Commands:
  lint        Check workspace for issues
  list        List notes, tags, orphans, placeholders, deadends, or templates
  note        Show, create, move, delete, or get the id of a note
  outline     Show the heading structure of a note
  links       Show links to/from a note (alias: connections)
  daily       Show or create the daily note for a date
  tag         List, rename, or search tags
  grep        Search note content (grep-style, no graph needed)
  search      Search by title, alias, tag, or frontmatter property
  rename      Rename a note, tag, section, or block anchor (with link rewriting)
  update      Check for updates and show the install command

Global options:
  --workspace <dir>   Workspace root (default: FOAM_WORKSPACE env var, then cwd)
  --format <fmt>      Output format: text (default) or json
  --help              Show help

Run "foam <command> --help" for command-specific help.
`;

export type { ILogger as CliLogger } from '@foam/core';

export function renderCliHelp() {
  return CLI_HELP;
}

class ConsoleLogger extends BaseLogger {
  log(level: LogLevel, msg?: string, ...params: any[]): void {
    const formattedMsg = level === 'info' ? msg : `[${level}] ${msg}`;
    console[level](formattedMsg, ...params);
  }
}

export async function runCli(
  argv: string[],
  logger: ILogger = new ConsoleLogger()
): Promise<number> {
  const [command, ...commandArgs] = argv;

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    logger.info(renderCliHelp());
    return 0;
  }

  // Show a passive update notice when the cache says a newer version is available.
  // Suppressed for the update command itself, JSON output, and non-TTY environments.
  if (command !== 'update' && !commandArgs.includes('--format json') && process.stdout.isTTY) {
    const notice = checkForUpdateNotice();
    if (notice) logger.info(notice);
  }

  try {
    switch (command) {
      case 'publish': {
        if (commandArgs.includes('--help') || commandArgs.includes('-h')) {
          logger.info(renderPublishHelp());
          return 0;
        }

        await runPublishCommand(parsePublishCommandArgs(commandArgs));
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
      case 'rename': {
        return runRenameCommand(commandArgs, logger);
      }
      case 'update': {
        return runUpdateCommand(commandArgs, logger);
      }
      default:
        logger.error(`Unknown command "${command}".\n\n${renderCliHelp()}`);
        return 1;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(message);
    return 1;
  }
}

async function main() {
  Logger.setLevel('info');
  const exitCode = await runCli(process.argv.slice(2));
  process.exitCode = exitCode;
}

if (require.main === module) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
