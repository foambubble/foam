/*
 * This file should not depend on VS Code as it's used for unit tests
 */
import path from 'path';
import { Logger } from '../core/utils/log';
import { Range } from '../core/model/range';
import { URI } from '../core/model/uri';
import { FoamWorkspace } from '../core/model/workspace';
import { Matcher } from '../core/services/datastore';
import { MarkdownResourceProvider } from '../core/markdown-provider';
import { NoteLinkDefinition, Resource } from '../core/model/note';

Logger.setLevel('error');

export const TEST_DATA_DIR = URI.joinPath(
  URI.file(__dirname),
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
  const provider = new MarkdownResourceProvider(matcher, undefined, undefined, {
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
  root?: URI;
}): Resource => {
  const root = params.root ?? URI.file('/');
  return {
    uri: URI.resolve(params.uri, root),
    type: 'note',
    properties: {},
    title: params.title ?? path.parse(strToUri(params.uri).path).base,
    definitions: params.definitions ?? [],
    sections: [],
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
                target: link.slug,
                label: link.slug,
                range: range,
                rawText: 'link text',
              }
            : {
                type: 'link',
                target: link.to,
                label: 'link text',
                range: range,
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
