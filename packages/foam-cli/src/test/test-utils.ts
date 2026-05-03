import fs from 'fs';
import { type ILogger, Logger, NoOpLogger } from '@foam/core';
import { Range } from '@foam/core';
import { URI } from '@foam/core';
import { FoamWorkspace } from '@foam/core';
import { MarkdownResourceProvider } from '@foam/core';
import { Resource } from '@foam/core';
import { createMarkdownParser } from '@foam/core';
import { IDataStore } from '@foam/core';

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

export const readFileFromFs = async (uri: URI) =>
  (await fs.promises.readFile(uri.toFsPath())).toString();

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
