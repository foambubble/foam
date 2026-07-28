import { createLezerMarkdownParser } from './lezer-parser';
import { describeParserConformance } from './parser-conformance';
import { Logger } from '../utils/log';
import { URI } from '../model/uri';

Logger.setLevel('error');

const parser = createLezerMarkdownParser();

// the same suite the remark parser is held to — see parser-conformance.ts
describeParserConformance(parser);

describe('Lezer parser (implementation-specific)', () => {
  it('does not recognise a hashtag inside inline code', () => {
    const note = parser.parse(
      URI.file('/a.md'),
      'text `code #nottag` and #realtag'
    );
    expect(note.tags.map(t => t.label)).toEqual(['realtag']);
  });

  it('does not recognise a hashtag inside a fenced code block', () => {
    const note = parser.parse(
      URI.file('/a.md'),
      '```\n#nottag\n```\n\n#realtag'
    );
    expect(note.tags.map(t => t.label)).toEqual(['realtag']);
  });

  it('does not recognise a hashtag inside a link target', () => {
    const note = parser.parse(
      URI.file('/a.md'),
      'a [text](./page.md#nottag) and #realtag'
    );
    expect(note.tags.map(t => t.label)).toEqual(['realtag']);
  });
});
