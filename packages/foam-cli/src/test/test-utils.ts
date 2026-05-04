import fs from 'fs';
import { mkdtempSync } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { type ILogger, Logger, NoOpLogger } from '@foam/core';
import { Range } from '@foam/core';
import { URI } from '@foam/core';
import { FoamWorkspace } from '@foam/core';
import { MarkdownResourceProvider } from '@foam/core';
import { Resource } from '@foam/core';
import { createMarkdownParser } from '@foam/core';
import { IDataStore } from '@foam/core';
import { loadWorkspaceFromDirectory } from '../support/filesystem';

Logger.setLevel('error');

export class InMemoryDataStore implements IDataStore {
  private files = new Map<string, string>();

  set(uri: URI, content: string): void {
    this.files.set(uri.path, content);
  }

  delete(uri: URI): void {
    this.files.delete(uri.path);
  }

  clear(): void {
    this.files.clear();
  }

  async list(): Promise<URI[]> {
    return Array.from(this.files.keys()).map(path => URI.parse(path, 'file'));
  }

  async read(uri: URI): Promise<string | null> {
    return this.files.get(uri.path) ?? null;
  }
}

const position = Range.create(0, 0, 0, 100);

export const strToUri = URI.file;

export const createTestWorkspace = (
  workspaceRoots: URI[] = [],
  dataStore?: IDataStore,
  directoryMode: 'resolve' | 'disabled' = 'resolve'
) => {
  const workspace = new FoamWorkspace(workspaceRoots);
  const parser = createMarkdownParser();
  const provider = new MarkdownResourceProvider(
    dataStore ?? {
      read: _ => Promise.resolve(''),
      list: () => Promise.resolve([]),
    },
    parser,
    ['.md'],
    directoryMode
  );
  workspace.registerProvider(provider);
  return workspace;
};

export const createTestNote = (params: {
  uri: string;
  title?: string;
  links?: Array<{ slug: string; definitionUrl?: string } | { to: string }>;
  tags?: string[];
  aliases?: string[];
  sections?: string[];
  root?: URI;
  type?: string;
  properties?: Record<string, unknown>;
}): Resource => {
  const root = params.root ?? URI.file('/');
  return {
    uri: root.resolve(params.uri),
    type: params.type ?? 'note',
    properties: params.properties ?? {},
    title: params.title ?? strToUri(params.uri).getBasename(),
    sections:
      params.sections?.map(label => ({
        label,
        level: 1,
        range: Range.create(0, 0, 1, 0),
      })) ?? [],
    blocks: [],
    tags:
      params.tags?.map(t => ({
        label: t,
        range: Range.create(0, 0, 0, 0),
      })) ?? [],
    aliases:
      params.aliases?.map(a => ({
        title: a,
        range: Range.create(0, 0, 0, 0),
      })) ?? [],
    links: params.links
      ? params.links.map((link, index) => {
          const range = Range.create(
            position.start.line + index,
            position.start.character,
            position.start.line + index,
            position.end.character
          );
          return 'slug' in link
            ? {
                type: 'wikilink',
                range: range,
                rawText: `[[${link.slug}]]`,
                isEmbed: false,
                definition: link.definitionUrl
                  ? {
                      label: link.slug,
                      url: link.definitionUrl,
                      range: Range.create(0, 0, 0, 0),
                    }
                  : link.slug,
              }
            : {
                type: 'link',
                range: range,
                rawText: `[link text](${link.to})`,
                isEmbed: false,
              };
        })
      : [],
    footnotes: [],
  };
};

const testParser = createMarkdownParser();

export const createNoteFromMarkdown = (
  uri: string,
  text: string,
  root: URI = URI.file('/')
): Resource => testParser.parse(root.resolve(uri), text);

export const TEST_WORKSPACE_ROOT = URI.file('/workspace');

export const createInMemoryWorkspace = (
  notes: Resource[],
  root: URI = TEST_WORKSPACE_ROOT
): ReturnType<typeof createTestWorkspace> => {
  const ws = createTestWorkspace([root]);
  for (const note of notes) ws.set(note);
  return ws;
};

export const readFileFromFs = async (uri: URI) =>
  (await fs.promises.readFile(uri.toFsPath())).toString();

/**
 * Creates a temporary workspace directory seeded with the given files,
 * loads it as a Foam workspace, and returns everything needed for testing.
 *
 * Usage:
 *   const { rootDir, workspace, foam, cleanup } = await createTmpWorkspace({
 *     'note.md': '# Note\n\nsome content',
 *     'ref.md': '[[note]]',
 *   });
 *   try { ... } finally { cleanup(); }
 */
export async function createTmpWorkspace(
  files: Record<string, string>,
  prefix = 'foam-test-'
) {
  const rootDir = mkdtempSync(path.join(tmpdir(), prefix));
  for (const [name, content] of Object.entries(files)) {
    const filePath = path.join(rootDir, name);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
  }
  const result = await loadWorkspaceFromDirectory(rootDir);
  return {
    ...result,
    cleanup: () => fs.rmSync(rootDir, { recursive: true, force: true }),
  };
}

/**
 * Creates a temporary workspace, runs `fn` with it, and cleans up afterwards.
 *
 * Usage:
 *   await withTmpWorkspace({ 'note.md': '# Note' }, async ({ rootDir, workspace }) => {
 *     // ...
 *   });
 */
export async function withTmpWorkspace<T>(
  files: Record<string, string>,
  fn: (ctx: Awaited<ReturnType<typeof createTmpWorkspace>>) => Promise<T>,
  prefix = 'foam-test-'
): Promise<T> {
  const ctx = await createTmpWorkspace(files, prefix);
  try {
    return await fn(ctx);
  } finally {
    ctx.cleanup();
  }
}

/**
 * A test logger that captures info/error output as instance properties.
 */
export class TestLogger implements ILogger {
  logs: string[] = [];
  errors: string[] = [];
  private _noop = new NoOpLogger();

  debug() {}
  info(msg?: any) { this.logs.push(String(msg)); }
  warn() {}
  error(msg?: any) { this.errors.push(String(msg)); }
  getLevel() { return this._noop.getLevel(); }
  setLevel(l: Parameters<ILogger['setLevel']>[0]) { this._noop.setLevel(l); }
}
