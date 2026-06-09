import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';

import {
  FoamError,
  FoamGraph,
  FoamWorkspace,
  URI,
  noteShowData,
  noteIdData,
  noteCreate,
  noteMove,
  noteDelete,
  resolveNote,
  uriToWorkspacePath,
} from '@foam/core';
import { loadWorkspaceFromDirectory } from '../support/filesystem';
import { serializeNoteDetail } from '../support/serializers';
import type { CommandRunResult } from '../support/with-telemetry';
import {
  parseArgs,
  getString,
  getFlag,
  resolveWorkspaceDir,
  noteRefFromCliArgs,
} from '../support/args';
import type { CliLogger, Format } from '../support/types';
import { bold, dim, path as pathColor } from '../support/colors';

// Re-export domain functions
export {
  noteShowData,
  noteIdData,
  noteCreate,
  noteMove,
  noteDelete,
} from '@foam/core';

// ─── Help ────────────────────────────────────────────────────────────────────

export const NOTE_HELP = `Usage: foam note <subcommand> [options]

Subcommands:
  show <identifier>    Print metadata or content of a note
  id <identifier>      Print the Foam identifier for a note
  create               Create a new note
  move <identifier>    Move/rename a note, rewriting all wikilinks
  delete <identifier>  Delete a note (moves to .foam/trash/ by default)

Options (all subcommands):
  --path <path>        Target by exact path instead of identifier resolution
  --workspace <dir>    Workspace root (default: FOAM_WORKSPACE env var, then cwd)
  --format <fmt>       text (default) or json
  --help               Show this help

Options (create):
  --trust              Allow JavaScript templates (new-note.js) to execute.
                       Off by default — only opt in when you authored the
                       templates in this workspace yourself.
`;

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatNoteShowText(
  data: ReturnType<typeof noteShowData>,
  workspace: FoamWorkspace
): string {
  const lines = [
    `${bold('ID:      ')} ${pathColor(data.id)}`,
    `${bold('Title:   ')} ${data.title}`,
    `${bold('Path:    ')} ${pathColor(uriToWorkspacePath(data.uri, workspace))}`,
    `${bold('Type:    ')} ${data.type}`,
  ];
  if (data.tags.length > 0) {
    lines.push(
      `${bold('Tags:    ')} ${data.tags.map(t => pathColor(`#${t}`)).join(' ')}`
    );
  }
  if (data.aliases.length > 0) {
    lines.push(`${bold('Aliases: ')} ${data.aliases.join(dim(', '))}`);
  }
  if ('links' in data && data.links) {
    const outgoing =
      data.links.outgoing.length > 0
        ? data.links.outgoing.map(pathColor).join(dim(', '))
        : dim('(none)');
    const incoming =
      data.links.incoming.length > 0
        ? data.links.incoming.map(pathColor).join(dim(', '))
        : dim('(none)');
    lines.push(`${bold('Links →  ')} ${outgoing}`);
    lines.push(`${bold('Links ←  ')} ${incoming}`);
  }
  return lines.join('\n');
}

// ─── Command runner ───────────────────────────────────────────────────────────

export async function runNoteCommand(
  argv: string[],
  logger: CliLogger,
  opts: { stdin?: NodeJS.ReadStream } = {}
): Promise<CommandRunResult> {
  const [subcommand, ...rest] = argv;

  if (!subcommand || subcommand === '--help' || subcommand === '-h') {
    logger.info(NOTE_HELP);
    return 0;
  }

  const parsed = parseArgs(rest);

  if (getFlag(parsed, 'help')) {
    logger.info(NOTE_HELP);
    return 0;
  }

  const format: Format = (getString(parsed, 'format') as Format) ?? 'text';
  const workspaceDir = resolveWorkspaceDir(parsed);
  const pathFlag = getString(parsed, 'path');

  const validSubcommands = ['show', 'id', 'create', 'move', 'delete'];
  if (!validSubcommands.includes(subcommand)) {
    logger.error(
      `Unknown subcommand "${subcommand}". Expected one of: ${validSubcommands.join(', ')}\n\n${NOTE_HELP}`
    );
    return 1;
  }

  if (subcommand === 'create') {
    const title = getString(parsed, 'title');
    const dir = getString(parsed, 'dir');
    const propStrings = parsed.multi.get('property') ?? [];
    const properties: Record<string, string> = {};
    for (const p of propStrings) {
      const eqIdx = p.indexOf('=');
      if (eqIdx > 0) {
        properties[p.slice(0, eqIdx)] = p.slice(eqIdx + 1);
      }
    }
    const { rootDir: createRootDir, foam, dataStore } =
      await loadWorkspaceFromDirectory(workspaceDir);
    const isTrusted = getFlag(parsed, 'trust');
    let result;
    try {
      result = await noteCreate(
        foam,
        dataStore,
        { title, dir, properties },
        isTrusted
      );
    } catch (err) {
      if (err instanceof FoamError && err.code === 'untrusted_workspace') {
        logger.error(
          `${err.message}\n\nRe-run with --trust if you authored the template yourself.`
        );
        return 1;
      }
      throw err;
    }
    if (format === 'json') {
      logger.info(
        JSON.stringify(
          { id: result.id, uri: result.uri.toFsPath() },
          null,
          2
        )
      );
    } else {
      const relPath = path.relative(createRootDir, result.uri.toFsPath());
      logger.info(`Created: ${relPath}  (id: ${result.id})`);
    }
    const telemetryProperties: Record<string, string> = {};
    if (result.templateType) {
      telemetryProperties['template-type'] = result.templateType;
    }
    if (result.templateFormat) {
      telemetryProperties['template-format'] = result.templateFormat;
    }
    return { exitCode: 0, telemetryProperties };
  }

  const { rootDir, workspace, dataStore } =
    await loadWorkspaceFromDirectory(workspaceDir);
  const identifier = parsed.positionals[0];
  const ref = noteRefFromCliArgs(identifier, pathFlag, rootDir);
  const resource = resolveNote(workspace, ref);

  if (subcommand === 'id') {
    const data = noteIdData(workspace, resource);
    if (format === 'json') {
      logger.info(
        JSON.stringify({ id: data.id, uri: data.uri.toFsPath() }, null, 2)
      );
    } else {
      logger.info(data.id);
    }
    return 0;
  }

  if (subcommand === 'show') {
    const includeLinks = getFlag(parsed, 'links');
    const showContent = getFlag(parsed, 'content');
    const graph = FoamGraph.fromWorkspace(workspace);
    const data = noteShowData(workspace, graph, resource, {
      includeLinks,
    });

    if (showContent) {
      const content = await fs.readFile(data.uri.toFsPath(), 'utf8');
      logger.info(content);
      return 0;
    }

    if (format === 'json') {
      logger.info(JSON.stringify(serializeNoteDetail(data, workspace), null, 2));
    } else {
      logger.info(formatNoteShowText(data, workspace));
    }
    return 0;
  }

  if (subcommand === 'move') {
    const toPath = getString(parsed, 'to');
    if (!toPath) {
      logger.error('Missing required option --to <path>.');
      return 1;
    }
    const newUri = URI.file(
      path.isAbsolute(toPath) ? toPath : path.resolve(rootDir, toPath)
    );
    const graph = FoamGraph.fromWorkspace(workspace);
    const result = await noteMove(
      workspace,
      graph,
      dataStore,
      resource,
      newUri
    );
    if (format === 'json') {
      logger.info(
        JSON.stringify(
          {
            old_uri: result.old_uri.toFsPath(),
            new_uri: result.new_uri.toFsPath(),
            old_id: result.old_id,
            id: result.id,
            updated_links: result.updated_links,
          },
          null,
          2
        )
      );
    } else {
      logger.info(
        `Moved: ${path.relative(rootDir, result.old_uri.toFsPath())} → ${path.relative(rootDir, result.new_uri.toFsPath())}  (id: ${result.id}, ${result.updated_links} link${result.updated_links === 1 ? '' : 's'} updated)`
      );
    }
    return 0;
  }

  if (subcommand === 'delete') {
    const force = getFlag(parsed, 'force');
    const permanent = getFlag(parsed, 'permanent');

    if (!force) {
      // Refuse if not a TTY (scripts must pass --force)
      const isTTY = (opts.stdin ?? process.stdin).isTTY;
      if (!isTTY) {
        logger.error(
          'stdin is not a TTY — pass --force to delete without confirmation.'
        );
        return 1;
      }

      const confirmed = await promptConfirm(
        `Delete ${path.relative(rootDir, resource.uri.toFsPath())}? [y/N] `,
        opts.stdin
      );
      if (!confirmed) {
        logger.info('Aborted.');
        return 0;
      }
    }

    const result = await noteDelete(workspace, dataStore, resource, {
      permanent,
    });
    if (format === 'json') {
      logger.info(
        JSON.stringify(
          {
            uri: result.uri.toFsPath(),
            source_uri: result.source_uri.toFsPath(),
            trashed: result.trashed,
          },
          null,
          2
        )
      );
    } else {
      if (result.trashed) {
        logger.info(
          `Trashed: ${path.relative(rootDir, result.source_uri.toFsPath())} → ${path.relative(rootDir, result.uri.toFsPath())}`
        );
      } else {
        logger.info(
          `Deleted: ${path.relative(rootDir, result.uri.toFsPath())}`
        );
      }
    }
    return 0;
  }

  return 0;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function promptConfirm(
  question: string,
  stdin?: NodeJS.ReadStream
): Promise<boolean> {
  return new Promise(resolve => {
    const rl = readline.createInterface({
      input: stdin ?? process.stdin,
      output: process.stdout,
    });
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}
