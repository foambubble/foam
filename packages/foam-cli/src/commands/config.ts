import type { ILogger } from '@foam/core';
import {
  getUserConfigPath,
  readRawUserConfig,
  writeRawUserConfig,
} from '../support/user-config';

export const CONFIG_HELP = `Usage: foam config <subcommand> [args]

Manage Foam's user-level configuration file (~/.config/foam/config.json).

Subcommands:
  get <key>           Print the current value of a setting
  set <key> <value>   Update a setting (creates the config file if needed)

Recognized keys:
  telemetry.enabled   Enable or disable anonymous usage telemetry (boolean)

Examples:
  foam config get telemetry.enabled
  foam config set telemetry.enabled false
`;

/**
 * Keys the CLI accepts for `foam config set/get`. Unknown keys are rejected
 * so users get an error on typos rather than silently writing dead entries.
 *
 * Add new entries as they become user-configurable.
 */
const KNOWN_KEYS: Record<
  string,
  { parse: (raw: string) => unknown; format: (value: unknown) => string }
> = {
  'telemetry.enabled': {
    parse: parseBoolean,
    format: value =>
      typeof value === 'boolean' ? String(value) : '(not set)',
  },
};

function parseBoolean(raw: string): boolean {
  const v = raw.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(v)) return true;
  if (['false', '0', 'no', 'off'].includes(v)) return false;
  throw new Error(
    `Invalid boolean value "${raw}". Use true/false, 1/0, yes/no, or on/off.`
  );
}

export async function runConfigCommand(
  argv: string[],
  logger: ILogger
): Promise<number> {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    logger.info(CONFIG_HELP);
    return argv.length === 0 ? 1 : 0;
  }

  const [subcommand, ...rest] = argv;

  switch (subcommand) {
    case 'get':
      return runGet(rest, logger);
    case 'set':
      return runSet(rest, logger);
    default:
      logger.error(`Unknown subcommand "${subcommand}".\n\n${CONFIG_HELP}`);
      return 1;
  }
}

function runGet(args: string[], logger: ILogger): number {
  if (args.length !== 1) {
    logger.error('Usage: foam config get <key>');
    return 1;
  }
  const [key] = args;
  const entry = KNOWN_KEYS[key];
  if (!entry) {
    logger.error(`Unknown config key "${key}".\n\n${CONFIG_HELP}`);
    return 1;
  }

  const raw = readRawUserConfig();
  logger.info(entry.format(raw[key]));
  return 0;
}

function runSet(args: string[], logger: ILogger): number {
  if (args.length !== 2) {
    logger.error('Usage: foam config set <key> <value>');
    return 1;
  }
  const [key, rawValue] = args;
  const entry = KNOWN_KEYS[key];
  if (!entry) {
    logger.error(`Unknown config key "${key}".\n\n${CONFIG_HELP}`);
    return 1;
  }

  let parsed: unknown;
  try {
    parsed = entry.parse(rawValue);
  } catch (e) {
    logger.error(e instanceof Error ? e.message : String(e));
    return 1;
  }

  const raw = readRawUserConfig();
  raw[key] = parsed;
  writeRawUserConfig(raw);

  logger.info(`${key} = ${entry.format(parsed)} (${getUserConfigPath()})`);
  return 0;
}
