import { NoteLinkDefinition, Note, Attachment } from '../src/model/note';
import { URI } from '../src/common/uri';
import { Logger } from '../src/utils/log';

Logger.setLevel('error');

const position = {
  start: { line: 1, column: 1 },
  end: { line: 1, column: 1 },
};

const documentStart = position.start;
const documentEnd = position.end;
const eol = '\n';

/**
 * Turns a string into a URI
 * The goal of this function is to make sure we are consistent in the
 * way we generate URIs (and therefore IDs) across the tests
 */
export const strToUri = URI.file;

export const createAttachment = (params: { uri: string }): Attachment => {
  return {
    uri: strToUri(params.uri),
    type: 'attachment',
  };
};

export const createTestNote = (params: {
  uri: string;
  title?: string;
  definitions?: NoteLinkDefinition[];
  links?: Array<{ slug: string } | { to: string }>;
  text?: string;
  root?: URI;
}): Note => {
  const root = params.root ?? URI.file('/');
  return {
    uri: strToUri(params.uri),
    type: 'note',
    properties: {},
    title: params.title ?? null,
    definitions: params.definitions ?? [],
    tags: new Set(),
    links: params.links
      ? params.links.map((link, index) => {
          const pos = {
            start: {
              line: position.start.line + index,
              column: position.start.column,
            },
            end: position.end,
          };
          return 'slug' in link
            ? {
                type: 'wikilink',
                slug: link.slug,
                target: link.slug,
                position: pos,
                text: 'link text',
              }
            : {
                type: 'link',
                target: link.to,
                label: 'link text',
                position: pos,
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
