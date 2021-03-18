import path from 'path';
import { NoteLinkDefinition, Note, Attachment } from '../src/model/note';
import * as ranges from '../src/model/range';
import { URI } from '../src/common/uri';
import { Logger } from '../src/utils/log';
import { parseUri } from '../src/utils';

Logger.setLevel('error');

const position = ranges.create(0, 0, 0, 100);

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
    uri: parseUri(root, params.uri),
    type: 'note',
    properties: {},
    title: params.title ?? path.parse(strToUri(params.uri).path).base,
    definitions: params.definitions ?? [],
    tags: new Set(),
    links: params.links
      ? params.links.map((link, index) => {
          const range = ranges.create(
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
