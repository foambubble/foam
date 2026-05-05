import type { ILogger } from '@foam/core';
import {
  getCurrentVersion,
  fetchLatestVersion,
  isNewerVersion,
} from '../support/version';

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
  logger.info(`Current version: ${current}`);

  let latest: string | null = null;
  try {
    latest = await fetchLatestVersion();
  } catch {
    logger.info('Could not reach npm registry to check for updates.');
  }

  if (latest !== null) {
    if (isNewerVersion(latest, current)) {
      logger.info(`Latest version:  ${latest}`);
    } else {
      logger.info(`You are already on the latest version.`);
    }
  }

  logger.info(`\nTo update, run:\n  npm install -g foam-cli@latest`);
  return 0;
}
