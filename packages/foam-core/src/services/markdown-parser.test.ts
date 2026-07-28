import {
  createMarkdownParser,
  getBlockFor,
  ParserCache,
  ParserCacheEntry,
  ParserPlugin,
} from './markdown-parser';
import { describeParserConformance } from './parser-conformance';
import { Logger } from '../utils/log';
import { URI } from '../model/uri';
import { Position } from '../model/position';

Logger.setLevel('error');

const parser = createMarkdownParser([]);

// the behaviour shared with every other ResourceParser implementation
describeParserConformance(parser);

describe('Markdown parsing (remark-specific)', () => {
  describe('Parser plugins', () => {
    const testPlugin: ParserPlugin = {
      visit: (node, note) => {
        if (node.type === 'heading') {
          note.properties.hasHeading = true;
        }
      },
    };
    const parser = createMarkdownParser([testPlugin]);

    it('can augment the parsing of the file', () => {
      const note1 = parser.parse(
        URI.file('/path/to/a'),
        `
This is a test note without headings.
But with some content.
`
      );
      expect(note1.properties.hasHeading).toBeUndefined();

      const note2 = parser.parse(
        URI.file('/path/to/a'),
        `
# This is a note with header
and some content`
      );
      expect(note2.properties.hasHeading).toBeTruthy();
    });
  });
  describe('Parse observer', () => {
    const createCache = (): ParserCache => {
      const entries = new Map<string, ParserCacheEntry>();
      return {
        get: uri => entries.get(uri.toString()),
        has: uri => entries.has(uri.toString()),
        set: (uri, entry) => void entries.set(uri.toString(), entry),
        del: uri => void entries.delete(uri.toString()),
        clear: () => entries.clear(),
      };
    };

    it('reports the size of every parsed note', () => {
      const samples = [];
      const observed = createMarkdownParser([], undefined, s =>
        samples.push(s)
      );
      const content = '# Title\nsome content';

      observed.parse(URI.file('/path/to/a.md'), content);

      expect(samples).toHaveLength(1);
      expect(samples[0].uri.path).toEqual('/path/to/a.md');
      expect(samples[0].chars).toEqual(content.length);
      expect(samples[0].cacheHit).toBeFalsy();
    });

    it('reports a single sample per parse when a cache is in use', () => {
      const samples = [];
      const observed = createMarkdownParser([], createCache(), s =>
        samples.push(s)
      );

      observed.parse(URI.file('/path/to/a.md'), '# Title');

      expect(samples).toHaveLength(1);
    });

    it('distinguishes a cache hit from a re-parse', () => {
      const samples = [];
      const uri = URI.file('/path/to/a.md');
      const observed = createMarkdownParser([], createCache(), s =>
        samples.push(s)
      );

      observed.parse(uri, '# Title');
      observed.parse(uri, '# Title');
      // changing the content invalidates the entry for that URI
      observed.parse(uri, '# Another title');

      expect(samples.map(s => s.cacheHit)).toEqual([false, true, false]);
    });

    it('is optional', () => {
      const plain = createMarkdownParser([]);
      expect(plain.parse(URI.file('/path/to/a.md'), '# Title').title).toEqual(
        'Title'
      );
    });
  });
});

describe('Block detection for lists', () => {
  const md = `
- this is block 1
- this is [[block]] 2
  - this is block 2.1
- this is block 3
  - this is block 3.1
    - this is block 3.1.1
  - this is block 3.2
- this is block 4
this is a simple line
this is another simple line
  `;

  it('can detect block', () => {
    const { block } = getBlockFor(md, 1);
    expect(block).toEqual('- this is block 1');
  });

  it('supports nested blocks 1', () => {
    const { block } = getBlockFor(md, 2);
    expect(block).toEqual(`- this is [[block]] 2
  - this is block 2.1`);
  });

  it('supports nested blocks 2', () => {
    const { block } = getBlockFor(md, 5);
    expect(block).toEqual(`  - this is block 3.1
    - this is block 3.1.1`);
  });

  it('returns the line if no block is detected', () => {
    const { block } = getBlockFor(md, 9);
    expect(block).toEqual(`this is a simple line`);
  });

  it('is compatible with Range object', () => {
    const note = parser.parse(URI.file('/path/to/a'), md);
    const { start } = note.links[0].range;
    const { block } = getBlockFor(md, start);
    expect(block).toEqual(`- this is [[block]] 2
  - this is block 2.1`);
  });
});

describe('block detection for sections', () => {
  const markdown = `
# Section 1
- this is block 1
- this is [[block]] 2
  - this is block 2.1

# Section 2
this is a simple line
this is another simple line

## Section 2.1
  - this is block 3.1
    - this is block 3.1.1
  - this is block 3.2

# Section 3
# Section 4
some text
some text
`;

  it('should return correct block for valid markdown string with line number', () => {
    const { block, nLines } = getBlockFor(markdown, 1);
    expect(block).toEqual(`# Section 1
- this is block 1
- this is [[block]] 2
  - this is block 2.1
`);
    expect(nLines).toEqual(5);
  });

  it('should return correct block for valid markdown string with position', () => {
    const { block, nLines } = getBlockFor(markdown, 6);
    expect(block).toEqual(`# Section 2
this is a simple line
this is another simple line

## Section 2.1
  - this is block 3.1
    - this is block 3.1.1
  - this is block 3.2
`);
    expect(nLines).toEqual(9);
  });

  it('should return single line for section with no content', () => {
    const { block, nLines } = getBlockFor(markdown, 15);
    expect(block).toEqual('# Section 3');
    expect(nLines).toEqual(1);
  });

  it('should return till end of file for last section', () => {
    const { block, nLines } = getBlockFor(markdown, 16);
    expect(block).toEqual(`# Section 4
some text
some text`);
    expect(nLines).toEqual(3);
  });

  it('should return single line for non-existing line number', () => {
    const { block, nLines } = getBlockFor(markdown, 100);
    expect(block).toEqual('');
    expect(nLines).toEqual(1);
  });

  it('should return single line for non-existing position', () => {
    const { block, nLines } = getBlockFor(markdown, Position.create(100, 2));
    expect(block).toEqual('');
    expect(nLines).toEqual(1);
  });
});
