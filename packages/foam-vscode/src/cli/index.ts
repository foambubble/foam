import { Logger } from '../core/utils/log';
import {
  parsePublishCommandArgs,
  renderPublishHelp,
  runPublishCommand,
} from './commands/publish';

const CLI_HELP = `Usage: foam <command> [options]

Commands:
  publish   Materialize a publish target from a Foam workspace

Run "foam <command> --help" for command-specific help.
`;

export interface CliLogger {
  error(message?: unknown): void;
  log(message?: unknown): void;
}

export function renderCliHelp() {
  return CLI_HELP;
}

export async function runCli(
  argv: string[],
  logger: CliLogger = console
): Promise<number> {
  const [command, ...commandArgs] = argv;

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    logger.log(renderCliHelp());
    return 0;
  }

  try {
    switch (command) {
      case 'publish': {
        if (commandArgs.includes('--help') || commandArgs.includes('-h')) {
          logger.log(renderPublishHelp());
          return 0;
        }

        await runPublishCommand(parsePublishCommandArgs(commandArgs));
        return 0;
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
