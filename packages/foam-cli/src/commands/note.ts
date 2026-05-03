import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';

import {
  type Foam,
  FoamGraph,
  FoamWorkspace,
  type IDataStore,
  NoteCreationEngine,
  Resolver,
  TemplateLoader,
  TextEdit,
  URI,
  computeWikilinkRenameEdits,
  getNewNoteTemplateCandidateUris,
  getTemplatesDir,
} from '@foam/core';
import { loadWorkspaceFromDirectory } from '../support/filesystem';
import {
  parseArgs,
  getString,
  getFlag,
  resolveWorkspaceDir,
} from '../support/args';
import type { CliLogger, Format } from '../support/types';
import { resolveNote } from '../support/workspace';

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
`;

// ─── Domain: show ─────────────────────────────────────────────────────────────

export function noteShowData(
  workspace: InstanceType<typeof FoamWorkspace>,
  graph: InstanceType<typeof FoamGraph>,
  identifier: string | undefined,
  pathFlag: string | undefined,
  rootDir: string,
  opts: { includeLinks?: boolean }
) {
  const resource = resolveNote(workspace, identifier, pathFlag);
  const id = workspace.getIdentifier(resource.uri);
  const relPath = path.relative(rootDir, resource.uri.toFsPath());

  const base = {
    id,
    uri: resource.uri.toFsPath(),
    path: relPath,
    title: resource.title,
    type: resource.type,
    tags: resource.tags.map(t => t.label),
    aliases: resource.aliases.map(a => a.title),
    properties: resource.properties,
  };

  if (!opts.includeLinks) {
    return base;
  }

  const outgoing = graph.getLinks(resource.uri).map(c => workspace.getIdentifier(c.target));
  const incoming = graph.getBacklinks(resource.uri).map(c => workspace.getIdentifier(c.source));
  return { ...base, links: { outgoing, incoming } };
}

function formatNoteShowText(data: ReturnType<typeof noteShowData>): string {
  const lines = [
    `ID:       ${data.id}`,
    `Title:    ${data.title}`,
    `Path:     ${data.path}`,
    `Type:     ${data.type}`,
  ];
  if (data.tags.length > 0) {
    lines.push(`Tags:     ${data.tags.map(t => `#${t}`).join(' ')}`);
  }
  if (data.aliases.length > 0) {
    lines.push(`Aliases:  ${data.aliases.join(', ')}`);
  }
  if ('links' in data && data.links) {
    lines.push(`Links →   ${data.links.outgoing.join(', ') || '(none)'}`);
    lines.push(`Links ←   ${data.links.incoming.join(', ') || '(none)'}`);
  }
  return lines.join('\n');
}

// ─── Domain: id ───────────────────────────────────────────────────────────────

export function noteIdData(
  workspace: InstanceType<typeof FoamWorkspace>,
  identifier: string | undefined,
  pathFlag: string | undefined
) {
  const resource = resolveNote(workspace, identifier, pathFlag);
  return {
    id: workspace.getIdentifier(resource.uri),
    uri: resource.uri.toFsPath(),
  };
}

// ─── Domain: create ───────────────────────────────────────────────────────────

export async function noteCreate(
  rootDir: string,
  foam: Foam,
  dataStore: IDataStore,
  opts: {
    title?: string;
    dir?: string;
    properties?: Record<string, string>;
  }
): Promise<{ id: string; uri: string; path: string }> {
  const title = opts.title ?? 'untitled';

  // Derive default fallback path from title
  const stem = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const targetDir = opts.dir ? path.resolve(rootDir, opts.dir) : rootDir;
  const fallbackPath = path.join(targetDir, `${stem}.md`);

  // Try new-note.md / new-note.js template
  const templatesDir = getTemplatesDir(rootDir);
  const candidates = getNewNoteTemplateCandidateUris(templatesDir);
  let fullPath = fallbackPath;
  const extraProps = opts.properties ?? {};
  const propLines = Object.entries(extraProps).map(([k, v]) => `${k}: ${v}`);
  const frontmatter = propLines.length > 0 ? `---\n${propLines.join('\n')}\n---\n\n` : '';
  let content = `${frontmatter}# ${title}\n`;

  for (const templateUri of candidates) {
    const templateContent = await dataStore.read(templateUri);
    if (templateContent === null) continue;

    const loader = new TemplateLoader(
      async uri => (await dataStore.read(uri)) ?? '',
      true
    );
    const template = await loader.loadTemplate(templateUri);
    const resolver = new Resolver(new Map(), new Date(), title);
    const engine = new NoteCreationEngine(foam);
    const result = await engine.processTemplate(
      { type: 'command', command: 'foam-cli.create-note', params: { title } },
      template,
      resolver
    );

    fullPath = foam.workspace.resolveUri(result.filepath.path).toFsPath();
    content = result.content;
    break;
  }

  // Error if file already exists
  try {
    await fs.access(fullPath);
    throw new Error(`File already exists: ${fullPath}`);
  } catch (err: any) {
    if (err.code !== 'ENOENT') throw err;
  }

  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content, 'utf8');

  const relPath = path.relative(rootDir, fullPath);
  const id = path.basename(fullPath, '.md');
  return { id, uri: fullPath, path: relPath };
}

// ─── Domain: move ─────────────────────────────────────────────────────────────

export async function noteMove(
  workspace: InstanceType<typeof FoamWorkspace>,
  graph: InstanceType<typeof FoamGraph>,
  rootDir: string,
  identifier: string | undefined,
  pathFlag: string | undefined,
  toPath: string
): Promise<{ old_uri: string; new_uri: string; old_id: string; id: string; updated_links: number }> {
  const resource = resolveNote(workspace, identifier, pathFlag);
  const oldUri = resource.uri;
  const newUri = URI.file(path.resolve(rootDir, toPath));

  if (oldUri.isEqual(newUri)) {
    throw new Error('Source and destination are the same.');
  }

  // Check destination doesn't exist
  try {
    await fs.access(newUri.toFsPath());
    throw new Error(`Destination already exists: ${newUri.toFsPath()}`);
  } catch (err: any) {
    if (err.code !== 'ENOENT') throw err;
  }

  const edits = computeWikilinkRenameEdits(workspace, graph, oldUri, newUri);

  // Apply link edits to referencing files
  for (const { uri, edit } of edits) {
    const filePath = uri.toFsPath();
    const content = await fs.readFile(filePath, 'utf8');
    const updated = TextEdit.apply(content, edit);
    await fs.writeFile(filePath, updated, 'utf8');
  }

  // Move the file itself
  await fs.mkdir(path.dirname(newUri.toFsPath()), { recursive: true });
  await fs.rename(oldUri.toFsPath(), newUri.toFsPath());

  const oldId = workspace.getIdentifier(oldUri);

  // Compute new id: rebuild workspace with new path
  workspace.delete(oldUri);
  workspace.set({ ...resource, uri: newUri });
  const newId = workspace.getIdentifier(newUri);

  return {
    old_uri: oldUri.toFsPath(),
    new_uri: newUri.toFsPath(),
    old_id: oldId,
    id: newId,
    updated_links: edits.length,
  };
}

// ─── Domain: delete ───────────────────────────────────────────────────────────

export async function noteDelete(
  workspace: InstanceType<typeof FoamWorkspace>,
  rootDir: string,
  identifier: string | undefined,
  pathFlag: string | undefined,
  opts: { permanent?: boolean }
): Promise<{ trashed_uri?: string; deleted_uri?: string; trash_uri?: string }> {
  const resource = resolveNote(workspace, identifier, pathFlag);
  const filePath = resource.uri.toFsPath();

  if (opts.permanent) {
    await fs.rm(filePath, { force: true });
    return { deleted_uri: filePath };
  }

  // Move to .foam/trash/
  const trashDir = path.join(rootDir, '.foam', 'trash');
  await fs.mkdir(trashDir, { recursive: true });
  const trashPath = path.join(trashDir, path.basename(filePath));
  await fs.rename(filePath, trashPath);
  return { trashed_uri: filePath, trash_uri: trashPath };
}

// ─── Command runner ───────────────────────────────────────────────────────────

export async function runNoteCommand(
  argv: string[],
  logger: CliLogger,
  opts: { stdin?: NodeJS.ReadStream } = {}
): Promise<number> {
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
    logger.error(`Unknown subcommand "${subcommand}". Expected one of: ${validSubcommands.join(', ')}\n\n${NOTE_HELP}`);
    return 1;
  }

  try {
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
      const { rootDir, foam, dataStore } = await loadWorkspaceFromDirectory(workspaceDir);
      const result = await noteCreate(rootDir, foam, dataStore, { title, dir, properties });
      if (format === 'json') {
        logger.info(JSON.stringify(result, null, 2));
      } else {
        logger.info(`Created: ${result.path}  (id: ${result.id})`);
      }
      return 0;
    }

    const { rootDir, workspace } = await loadWorkspaceFromDirectory(workspaceDir);
    const identifier = parsed.positionals[0];

    if (subcommand === 'id') {
      const data = noteIdData(workspace, identifier, pathFlag);
      if (format === 'json') {
        logger.info(JSON.stringify(data, null, 2));
      } else {
        logger.info(data.id);
      }
      return 0;
    }

    if (subcommand === 'show') {
      const includeLinks = getFlag(parsed, 'links');
      const showContent = getFlag(parsed, 'content');
      const graph = includeLinks ? FoamGraph.fromWorkspace(workspace) : null;
      const data = noteShowData(
        workspace,
        graph ?? FoamGraph.fromWorkspace(workspace),
        identifier,
        pathFlag,
        rootDir,
        { includeLinks }
      );

      if (showContent) {
        const content = await fs.readFile(data.uri, 'utf8');
        logger.info(content);
        return 0;
      }

      if (format === 'json') {
        logger.info(JSON.stringify(data, null, 2));
      } else {
        logger.info(formatNoteShowText(data));
      }
      return 0;
    }

    if (subcommand === 'move') {
      const toPath = getString(parsed, 'to');
      if (!toPath) {
        logger.error('Missing required option --to <path>.');
        return 1;
      }
      const graph = FoamGraph.fromWorkspace(workspace);
      const result = await noteMove(workspace, graph, rootDir, identifier, pathFlag, toPath);
      if (format === 'json') {
        logger.info(JSON.stringify(result, null, 2));
      } else {
        logger.info(
          `Moved: ${path.relative(rootDir, result.old_uri)} → ${path.relative(rootDir, result.new_uri)}  (id: ${result.id}, ${result.updated_links} link${result.updated_links === 1 ? '' : 's'} updated)`
        );
      }
      return 0;
    }

    if (subcommand === 'delete') {
      const force = getFlag(parsed, 'force');
      const permanent = getFlag(parsed, 'permanent');
      const resource = resolveNote(workspace, identifier, pathFlag);

      if (!force) {
        // Refuse if not a TTY (scripts must pass --force)
        const isTTY = (opts.stdin ?? process.stdin).isTTY;
        if (!isTTY) {
          logger.error('stdin is not a TTY — pass --force to delete without confirmation.');
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

      const result = await noteDelete(workspace, rootDir, identifier, pathFlag, { permanent });
      if (format === 'json') {
        logger.info(JSON.stringify(result, null, 2));
      } else {
        if (result.trash_uri) {
          logger.info(
            `Trashed: ${path.relative(rootDir, result.trashed_uri!)} → ${path.relative(rootDir, result.trash_uri)}`
          );
        } else {
          logger.info(`Deleted: ${path.relative(rootDir, result.deleted_uri!)}`);
        }
      }
      return 0;
    }

    return 0;
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
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
