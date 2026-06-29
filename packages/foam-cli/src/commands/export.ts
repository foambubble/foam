import fs from 'node:fs';
import path from 'node:path';

import { Logger } from '@foam/core';
import { buildSite } from '../export';
import { writeStarlightSite } from '../export/targets/starlight';
import { loadWorkspaceFromDirectory } from '../support/filesystem';

interface ParsedArgs {
  options: Map<string, string | boolean>;
  positionals: string[];
}

const EXPORT_HELP = `Usage: foam export [workspace-dir] --out <dir> [options]

Options:
  --target <name>         Export target to materialize (default: starlight)
  --out <dir>             Output directory for the generated site
  --title <text>          Site title
  --description <text>    Site description
  --content-root <path>   Note subtree to export relative to the workspace root
  --homepage <route>      Homepage route or source path
  --site-url <url>        Public site URL for Astro/Starlight metadata
  --help                  Show export command help
`;

export interface ExportCommandOptions {
  workspaceDir: string;
  outputDir: string;
  target: string;
  title?: string;
  description?: string;
  contentRoot?: string;
  homepage?: string;
  siteUrl?: string;
}

function getStringOption(
  options: Map<string, string | boolean>,
  name: string
) {
  const value = options.get(name);
  return typeof value === 'string' ? value : undefined;
}

function parseArgs(argv: string[]): ParsedArgs {
  const options = new Map<string, string | boolean>();
  const positionals: string[] = [];

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--') {
      positionals.push(...argv.slice(index + 1));
      break;
    }

    if (arg.startsWith('--')) {
      const [name, inlineValue] = arg.slice(2).split('=', 2);
      if (inlineValue !== undefined) {
        options.set(name, inlineValue);
        continue;
      }

      const nextArg = argv[index + 1];
      if (nextArg && !nextArg.startsWith('-')) {
        options.set(name, nextArg);
        index++;
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

  return {
    options,
    positionals,
  };
}

export function renderExportHelp() {
  return EXPORT_HELP;
}

export function parseExportCommandArgs(argv: string[]): ExportCommandOptions {
  const parsed = parseArgs(argv);
  const target = getStringOption(parsed.options, 'target') ?? 'starlight';
  const outputDir = getStringOption(parsed.options, 'out');

  if (parsed.options.has('help')) {
    throw new Error(renderExportHelp());
  }

  if (!outputDir) {
    throw new Error('Missing required option "--out".');
  }

  if (parsed.positionals.length > 1) {
    throw new Error(
      `Expected at most one workspace directory, received ${parsed.positionals.length}.`
    );
  }

  return {
    workspaceDir: parsed.positionals[0] ?? process.cwd(),
    outputDir,
    target,
    title: getStringOption(parsed.options, 'title'),
    description: getStringOption(parsed.options, 'description'),
    contentRoot: getStringOption(parsed.options, 'content-root'),
    homepage: getStringOption(parsed.options, 'homepage'),
    siteUrl: getStringOption(parsed.options, 'site-url'),
  };
}

export async function runExportCommand(options: ExportCommandOptions) {
  const outputDir = path.resolve(options.outputDir);

  if (options.target !== 'starlight') {
    throw new Error(
      `Unsupported export target "${options.target}". Expected "starlight".`
    );
  }

  const loaded = await loadWorkspaceFromDirectory(options.workspaceDir, {
    excludedPaths: [outputDir],
  });

  const artifactSet = await buildSite({
    workspace: loaded.workspace,
    contentRoot: options.contentRoot,
    include: resource => resource.properties.publish !== false,
    site: {
      title: options.title,
      description: options.description,
      homepage: options.homepage,
    },
  });

  const graphBundlePath = path.join(__dirname, 'foam-graph.standalone.js');
  const faviconPath = path.join(__dirname, 'assets', 'foam-icon.svg');

  await writeStarlightSite({
    artifactSet,
    outputDir,
    siteUrl: options.siteUrl,
    graphBundlePath: fs.existsSync(graphBundlePath)
      ? graphBundlePath
      : undefined,
    faviconPath: fs.existsSync(faviconPath) ? faviconPath : undefined,
  });

  for (const diagnostic of artifactSet.diagnostics) {
    Logger.warn(diagnostic.message);
  }

  if (artifactSet.diagnostics.length > 0) {
    Logger.warn(
      `Export completed with ${artifactSet.diagnostics.length} warning(s).`
    );
  }

  Logger.info(
    `Exported ${artifactSet.notes.length} notes and ${artifactSet.assets.length} assets to ${outputDir}`
  );
}
