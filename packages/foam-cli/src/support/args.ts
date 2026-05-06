/**
 * Minimal argument parser for foam CLI commands.
 *
 * Supports:
 *   --flag value
 *   --flag=value
 *   --flag          (boolean true)
 *   -h              (alias for --help)
 *   positional args
 *
 * Repeatable flags (e.g. --tag foo --tag bar) are collected via getStrings().
 */

import path from 'node:path';
import { type NoteRef, URI, FoamError } from '@foam/core';

export interface ParsedArgs {
  options: Map<string, string | boolean>;
  /** All values for each flag name, in order. Used for repeatable flags. */
  multi: Map<string, string[]>;
  positionals: string[];
}

export function parseArgs(argv: string[]): ParsedArgs {
  const options = new Map<string, string | boolean>();
  const multi = new Map<string, string[]>();
  const positionals: string[] = [];

  const pushMulti = (name: string, value: string) => {
    const existing = multi.get(name);
    if (existing) {
      existing.push(value);
    } else {
      multi.set(name, [value]);
    }
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--') {
      positionals.push(...argv.slice(i + 1));
      break;
    }

    if (arg.startsWith('--')) {
      const [name, inlineValue] = arg.slice(2).split('=', 2);
      if (inlineValue !== undefined) {
        options.set(name, inlineValue);
        pushMulti(name, inlineValue);
        continue;
      }
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('-')) {
        options.set(name, next);
        pushMulti(name, next);
        i++;
        continue;
      }
      options.set(name, true);
      continue;
    }

    if (arg === '-h') {
      options.set('help', true);
      continue;
    }

    positionals.push(arg);
  }

  return { options, multi, positionals };
}

export function getString(parsed: ParsedArgs, name: string): string | undefined;
export function getString(options: Map<string, string | boolean>, name: string): string | undefined;
export function getString(
  parsedOrOptions: ParsedArgs | Map<string, string | boolean>,
  name: string
): string | undefined {
  const options =
    parsedOrOptions instanceof Map
      ? parsedOrOptions
      : parsedOrOptions.options;
  const v = options.get(name);
  return typeof v === 'string' ? v : undefined;
}

/** Returns all values for a repeatable flag (e.g. --tag foo --tag bar). */
export function getStrings(parsed: ParsedArgs, name: string): string[] {
  return parsed.multi.get(name) ?? [];
}

export function getFlag(parsed: ParsedArgs, name: string): boolean;
export function getFlag(options: Map<string, string | boolean>, name: string): boolean;
export function getFlag(
  parsedOrOptions: ParsedArgs | Map<string, string | boolean>,
  name: string
): boolean {
  const options =
    parsedOrOptions instanceof Map
      ? parsedOrOptions
      : parsedOrOptions.options;
  return options.get(name) === true;
}

/** Resolve workspace dir from --workspace flag, FOAM_WORKSPACE env, or cwd. */
export function resolveWorkspaceDir(parsed: ParsedArgs): string;
export function resolveWorkspaceDir(options: Map<string, string | boolean>): string;
export function resolveWorkspaceDir(
  parsedOrOptions: ParsedArgs | Map<string, string | boolean>
): string {
  return (
    getString(parsedOrOptions as any, 'workspace') ??
    process.env['FOAM_WORKSPACE'] ??
    process.cwd()
  );
}

/**
 * Builds a {@link NoteRef} from CLI inputs: a positional `<identifier>`
 * argument and/or a `--path <path>` flag. The path is resolved against
 * `rootDir` if relative.
 *
 * Throws `invalid_input` when neither is provided. The CLI runner is
 * responsible for catching this and rendering the appropriate help text.
 */
export function noteRefFromCliArgs(
  identifier: string | undefined,
  pathFlag: string | undefined,
  rootDir: string
): NoteRef {
  if (pathFlag) {
    const abs = path.isAbsolute(pathFlag)
      ? pathFlag
      : path.resolve(rootDir, pathFlag);
    return { uri: URI.file(abs) };
  }
  if (identifier) {
    return { identifier };
  }
  throw new FoamError(
    'invalid_input',
    'Provide a note identifier or --path <path>.'
  );
}
