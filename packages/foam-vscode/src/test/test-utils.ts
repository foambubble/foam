/*
 * This file should not depend on VS Code as it's used for unit tests
 */
import fs from 'fs';
import { Logger } from '../core/utils/log';
import { Range } from '../core/model/range';
import { URI } from '../core/model/uri';
import { FoamWorkspace } from '../core/model/workspace';
import { MarkdownResourceProvider } from '../core/services/markdown-provider';
import { Resource } from '../core/model/note';
import { createMarkdownParser } from '../core/services/markdown-parser';
import { IDataStore } from '../core/services/datastore';

export { default as waitForExpect } from 'wait-for-expect';

Logger.setLevel('error');

/**
 * An in-memory data store for testing that stores file content in a Map.
 * This allows tests to provide text content for notes without touching the filesystem.
 */
export class InMemoryDataStore implements IDataStore {
  private files = new Map<string, string>();

  /**
   * Set the content for a file
   */
  set(uri: URI, content: string): void {
    this.files.set(uri.path, content);
  }

  /**
   * Delete a file
   */
  delete(uri: URI): void {
    this.files.delete(uri.path);
  }

  /**
   * Clear all files
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
}

export const TEST_DATA_DIR = URI.file(__dirname).joinPath(
  '..',
  '..',
  'test-data'
);

const position = Range.create(0, 0, 0, 100);

/**
 * Turns a string into a URI
 * The goal of this function is to make sure we are consistent in the
 * way we generate URIs (and therefore IDs) across the tests
 */
export const strToUri = URI.file;

export const createTestWorkspace = (
  workspaceRoots: URI[] = [],
  dataStore?: IDataStore
) => {
  const workspace = new FoamWorkspace();
  const parser = createMarkdownParser();
  const provider = new MarkdownResourceProvider(
    dataStore ?? {
      read: _ => Promise.resolve(''),
      list: () => Promise.resolve([]),
    },
    parser,
    ['.md'],
    workspaceRoots
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
}): Resource => {
  const root = params.root ?? URI.file('/');
  return {
    uri: root.resolve(params.uri),
    type: params.type ?? 'note',
    properties: {},
    title: params.title ?? strToUri(params.uri).getBasename(),
    sections: params.sections?.map(label => ({
      label,
      range: Range.create(0, 0, 1, 0),
    })),
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
  };
};

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

/** Use fs for reading files in units where vscode.workspace is unavailable */
export const readFileFromFs = async (uri: URI) =>
  (await fs.promises.readFile(uri.toFsPath())).toString();
