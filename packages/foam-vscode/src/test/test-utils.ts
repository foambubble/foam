/*
 * This file should not depend on VS Code as it's used for unit tests
 */
import fs from 'fs';
import { Logger } from '../core/utils/log';
import { Range } from '../core/model/range';
import { URI } from '../core/model/uri';
import { FoamWorkspace } from '../core/model/workspace';
import { Matcher } from '../core/services/datastore';
import { MarkdownResourceProvider } from '../core/services/markdown-provider';
import { NoteLinkDefinition, Resource } from '../core/model/note';

export { default as waitForExpect } from 'wait-for-expect';

Logger.setLevel('error');

export const TEST_DATA_DIR = URI.file(__dirname).joinPath(
  '..',
  '..',
  'test-data'
);

const position = Range.create(0, 0, 0, 100);

const documentStart = position.start;
const documentEnd = position.end;
const eol = '\n';

/**
 * Turns a string into a URI
 * The goal of this function is to make sure we are consistent in the
 * way we generate URIs (and therefore IDs) across the tests
 */
export const strToUri = URI.file;

export const createTestWorkspace = () => {
  const workspace = new FoamWorkspace();
  const matcher = new Matcher([URI.file('/')], ['**/*']);
  const provider = new MarkdownResourceProvider(matcher, {
    read: _ => Promise.resolve(''),
    list: _ => Promise.resolve([]),
  });
  workspace.registerProvider(provider);
  return workspace;
};

export const createTestNote = (params: {
  uri: string;
  title?: string;
  definitions?: NoteLinkDefinition[];
  links?: Array<{ slug: string } | { to: string }>;
  tags?: string[];
  text?: string;
  sections?: string[];
  root?: URI;
}): Resource => {
  const root = params.root ?? URI.file('/');
  return {
    uri: root.resolve(params.uri),
    type: 'note',
    properties: {},
    title: params.title ?? strToUri(params.uri).getBasename(),
    definitions: params.definitions ?? [],
    sections: params.sections?.map(label => ({
      label,
      range: Range.create(0, 0, 1, 0),
    })),
    tags:
      params.tags?.map(t => ({
        label: t,
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
              }
            : {
                type: 'link',
                range: range,
                rawText: `[link text](${link.to})`,
              };
        })
      : [],
    source: {
      eol: eol,
      end: documentEnd,
      contentStart: documentStart,
      text: params.text ?? '',
    },
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
