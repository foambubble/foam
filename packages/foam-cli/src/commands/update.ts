import type { ILogger } from '@foam/core';
import {
  getCurrentVersion,
  fetchLatestVersion,
  isNewerVersion,
} from '../support/version';
import { bold, dim, success } from '../support/colors';

const UPDATE_HELP = `Usage: foam update

Check for a newer version of foam-cli and show the install command.

Options:
  --help    Show this help
`;

export async function runUpdateCommand(
  argv: string[],
  logger: ILogger
): Promise<number> {
  if (argv.includes('--help') || argv.includes('-h')) {
    logger.info(UPDATE_HELP);
    return 0;
  }

  const current = getCurrentVersion();
  logger.info(`${bold('Current version:')} ${current}`);

  let latest: string | null = null;
  try {
    latest = await fetchLatestVersion();
  } catch {
    logger.info(dim('Could not reach npm registry to check for updates.'));
  }

  if (latest !== null) {
    if (isNewerVersion(latest, current)) {
      logger.info(`${bold('Latest version:')}  ${latest}`);
      logger.info(`\n${bold('To update, run:')}\n  ${bold('npm install -g foam-cli@latest')}`);
    } else {
      logger.info(success('You are already on the latest version.'));
    }
  } else {
    logger.info(`\n${bold('To update, run:')}\n  ${bold('npm install -g foam-cli@latest')}`);
  }
  return 0;
}
