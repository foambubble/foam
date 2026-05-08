import fs from 'fs';
import { Logger } from '../src/utils/log';
import { Range } from '../src/model/range';
import { URI } from '../src/model/uri';
import { FoamWorkspace } from '../src/model/workspace';
import { MarkdownResourceProvider } from '../src/services/markdown-provider';
import { Resource } from '../src/model/note';
import { createMarkdownParser } from '../src/services/markdown-parser';
import { IDataStore } from '../src/services/datastore';

export { default as waitForExpect } from 'wait-for-expect';

Logger.setLevel('error');

/**
 * An in-memory data store for testing that stores file content in a Map.
 */
export class InMemoryDataStore implements IDataStore {
  private files = new Map<string, string>();

  /**
   * Sync helper for test setup — populate without going through the async API.
   */
  set(uri: URI, content: string): void {
    this.files.set(uri.path, content);
  }

  /**
   * Sync helper to clear all files.
   */
  clear(): void {
    this.files.clear();
  }

  async list(): Promise<URI[]> {
    return Array.from(this.files.keys()).map(path => URI.parse(path, 'file'));
  }

  async read(uri: URI): Promise<string | null> {
    return this.files.get(uri.path) ?? null;
  }

  async write(uri: URI, content: string): Promise<void> {
    this.files.set(uri.path, content);
  }

  async delete(uri: URI): Promise<void> {
    this.files.delete(uri.path);
  }

  async move(from: URI, to: URI): Promise<void> {
    const content = this.files.get(from.path);
    if (content === undefined) {
      throw new Error(`InMemoryDataStore.move: source not found: ${from.path}`);
    }
    this.files.delete(from.path);
    this.files.set(to.path, content);
  }

  async exists(uri: URI): Promise<boolean> {
    return this.files.has(uri.path);
  }
}

export const TEST_DATA_DIR = URI.file(__dirname).joinPath('..', 'test-data');

const position = Range.create(0, 0, 0, 100);

export const strToUri = URI.file;

/**
 * Default root for test workspaces. Tests that don't care about specific
 * workspace roots get one automatically so absolute-path resolution works
 * via the under-root branch of `resolveUri`.
 *
 * Tests that need to exercise multi-root behavior or specific paths can
 * pass their own `workspaceRoots`.
 */
const DEFAULT_TEST_ROOT = URI.file('/');

export const createTestWorkspace = (
  workspaceRoots: URI[] = [DEFAULT_TEST_ROOT],
  dataStore?: IDataStore,
  directoryMode: 'resolve' | 'disabled' = 'resolve'
) => {
  const workspace = new FoamWorkspace(workspaceRoots);
  const parser = createMarkdownParser();
  const provider = new MarkdownResourceProvider(
    dataStore ?? {
      read: _ => Promise.resolve(''),
      list: () => Promise.resolve([]),
      write: () => Promise.resolve(),
      delete: () => Promise.resolve(),
      move: () => Promise.resolve(),
      exists: () => Promise.resolve(false),
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

export const wait = (ms: number) =>
  new Promise(resolve => setTimeout(resolve, ms));

const chars = 'abcdefghijklmnopqrstuvwyxzABCDEFGHIJKLMNOPQRSTUVWYXZ1234567890';
export const randomString = (len = 5) =>
  new Array(len)
    .fill('')
    .map(() => chars.charAt(Math.floor(Math.random() * chars.length)))
    .join('');

export const getRandomURI = () =>
  URI.file('/random-uri-root/' + randomString() + '.md');

export const readFileFromFs = async (uri: URI) =>
  (await fs.promises.readFile(uri.toFsPath())).toString();
