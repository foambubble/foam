import path from 'path';
import { FoamWorkspace } from '../src';
import { NoteLinkDefinition, Resource } from '../src/model/note';
import { IDataStore, Matcher } from '../src/services/datastore';
import { MarkdownResourceProvider } from '../src/markdown-provider';
import { Range } from '../src/model/range';
import { URI } from '../src/model/uri';
import { Logger } from '../src/utils/log';

Logger.setLevel('error');

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

export const noOpDataStore = (): IDataStore => ({
  read: _ => Promise.resolve(''),
  list: _ => Promise.resolve([]),
});

export const createTestWorkspace = () => {
  const workspace = new FoamWorkspace();
  const matcher = new Matcher([URI.file('/')], ['**/*']);
  const provider = new MarkdownResourceProvider(
    matcher,
    undefined,
    undefined,
    noOpDataStore()
  );
  workspace.registerProvider(provider);
  return workspace;
};

export const createTestNote = (params: {
  uri: string;
  title?: string;
  definitions?: NoteLinkDefinition[];
  links?: Array<{ slug: string } | { to: string }>;
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
    tags: new Set(),
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
                slug: link.slug,
                target: link.slug,
                range: range,
                text: 'link text',
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

describe('Test utils', () => {
  it('are happy', () => {});
});
