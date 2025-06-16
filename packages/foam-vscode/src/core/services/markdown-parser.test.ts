import {
  createMarkdownParser,
  getBlockFor,
  ParserPlugin,
} from './markdown-parser';
import { Logger } from '../utils/log';
import { URI } from '../model/uri';
import { Range } from '../model/range';
import {
  getRandomURI,
  TEST_DATA_DIR,
  readFileFromFs,
} from '../../test/test-utils';
import { Position } from '../model/position';

Logger.setLevel('error');

const parser = createMarkdownParser([]);
const createNoteFromMarkdown = (content: string, path?: string) =>
  parser.parse(path ? URI.file(path) : getRandomURI(), content);

describe('Markdown parsing', () => {
  it('should create a Resource from a markdown file', () => {
    const note = createNoteFromMarkdown('Note content', '/a/path.md');
    expect(note.uri).toEqual(URI.file('/a/path.md'));
  });

  describe('Links', () => {
    it('should skip external links', () => {
      const note = createNoteFromMarkdown(
        `this is a [link to google](https://www.google.com)`
      );
      expect(note.links.length).toEqual(0);
    });

    it('should skip links to a section within the file', () => {
      const note = createNoteFromMarkdown(
        `this is a [link to intro](#introduction)`
      );
      expect(note.links.length).toEqual(0);
    });

    it('should detect regular markdown links', () => {
      const note = createNoteFromMarkdown(
        'this is a [link to page b](../doc/page-b.md)'
      );
      expect(note.links.length).toEqual(1);
      const link = note.links[0];
      expect(link.type).toEqual('link');
      expect(link.rawText).toEqual('[link to page b](../doc/page-b.md)');
      expect(link.isEmbed).toBeFalsy();
    });

    it('should detect links that have formatting in label', () => {
      const note = createNoteFromMarkdown(
        'this is [**link** with __formatting__](../doc/page-b.md)'
      );
      expect(note.links.length).toEqual(1);
      const link = note.links[0];
      expect(link.type).toEqual('link');
      expect(link.isEmbed).toBeFalsy();
    });

    it('should detect embed links', () => {
      const note = createNoteFromMarkdown('this is ![link](../doc/page-b.md)');
      expect(note.links.length).toEqual(1);
      const link = note.links[0];
      expect(link.type).toEqual('link');
      expect(link.isEmbed).toBeTruthy();
    });

    it('should detect wikilinks', () => {
      const note = createNoteFromMarkdown(
        'Some content and [[a link]] to [[a file]]'
      );
      expect(note.links.length).toEqual(2);
      let link = note.links[0];
      expect(link.type).toEqual('wikilink');
      expect(link.rawText).toEqual('[[a link]]');
      link = note.links[1];
      expect(link.type).toEqual('wikilink');
      expect(link.rawText).toEqual('[[a file]]');
      expect(link.isEmbed).toBeFalsy();
    });

    it('should detect wikilink embeds', () => {
      const note = createNoteFromMarkdown('Some content and ![[an embed]]');
      expect(note.links.length).toEqual(1);
      const link = note.links[0];
      expect(link.type).toEqual('wikilink');
      expect(link.rawText).toEqual('![[an embed]]');
      expect(link.isEmbed).toBeTruthy();
    });

    it('should detect wikilinks that have aliases', () => {
      const note = createNoteFromMarkdown(
        'this is [[link|link alias]]. A link with spaces [[other link | spaced]]'
      );
      expect(note.links.length).toEqual(2);
      let link = note.links[0];
      expect(link.type).toEqual('wikilink');
      expect(link.rawText).toEqual('[[link|link alias]]');
      link = note.links[1];
      expect(link.type).toEqual('wikilink');
      expect(link.rawText).toEqual('[[other link | spaced]]');
      expect(link.isEmbed).toBeFalsy();
    });

    it('should skip wikilinks in codeblocks', () => {
      const noteA = createNoteFromMarkdown(`
this is some text with our [[first-wikilink]].

\`\`\`
this is inside a [[codeblock]]
\`\`\`

this is some text with our [[second-wikilink]].
    `);
      expect(noteA.links.map(l => l.rawText)).toEqual([
        '[[first-wikilink]]',
        '[[second-wikilink]]',
      ]);
    });

    it('should skip wikilinks in inlined codeblocks', () => {
      const noteA = createNoteFromMarkdown(`
this is some text with our [[first-wikilink]].

this is \`inside a [[codeblock]]\`

this is some text with our [[second-wikilink]].
    `);
      expect(noteA.links.map(l => l.rawText)).toEqual([
        '[[first-wikilink]]',
        '[[second-wikilink]]',
      ]);
    });
  });

  describe('Note Title', () => {
    it('should initialize note title if heading exists', () => {
      const note = createNoteFromMarkdown(`
# Page A
this note has a title
    `);
      expect(note.title).toBe('Page A');
    });

    it('should support wikilinks and urls in title', () => {
      const note = createNoteFromMarkdown(`
# Page A with [[wikilink]] and a [url](https://google.com)
this note has a title
    `);
      expect(note.title).toBe('Page A with wikilink and a url');
    });

    it('should default to file name if heading does not exist', () => {
      const note = createNoteFromMarkdown(
        `This file has no heading.`,
        '/page-d.md'
      );

      expect(note.title).toEqual('page-d');
    });

    it('should give precedence to frontmatter title over other headings', () => {
      const note = createNoteFromMarkdown(`
---
title: Note Title
date: 20-12-12
---

# Other Note Title
    `);

      expect(note.title).toBe('Note Title');
    });

    it('should support numbers as title', () => {
      const note1 = createNoteFromMarkdown(`hello`, '/157.md');
      expect(note1.title).toBe('157');

      const note2 = createNoteFromMarkdown(`# 158`, '/157.md');
      expect(note2.title).toBe('158');

      const note3 = createNoteFromMarkdown(
        `
---
title: 159
---

# 158
`,
        '/157.md'
      );
      expect(note3.title).toBe('159');
    });

    it('should support empty titles (see #276)', () => {
      const note = createNoteFromMarkdown(
        `
#

this note has an empty title line
    `,
        '/Hello Page.md'
      );
      expect(note.title).toEqual('Hello Page');
    });
  });
  describe('Block Identifiers', () => {
    it('should parse block identifiers as definitions', async () => {
      const content = await readFileFromFs(
        TEST_DATA_DIR.joinPath('block-identifiers', 'paragraph.md')
      );
      const note = createNoteFromMarkdown(content, 'paragraph.md');
      expect(note.definitions).toEqual([
        {
          type: 'block',
          label: '^p1',
          url: '#^p1',
          range: Range.create(0, 19, 0, 22),
        },
      ]);
    });
  });

  describe('Frontmatter', () => {
    it('should parse yaml frontmatter', () => {
      const note = createNoteFromMarkdown(`
---
title: Note Title
date: 20-12-12
---

# Other Note Title`);

      expect(note.properties.title).toBe('Note Title');
      expect(note.properties.date).toBe('20-12-12');
    });

    it('should parse empty frontmatter', () => {
      const note = createNoteFromMarkdown(`
---
---

# Empty Frontmatter
`);

      expect(note.properties).toEqual({});
    });

    it('should not fail when there are issues with parsing frontmatter', () => {
      const note = createNoteFromMarkdown(`
---
title: - one
 - two
 - #
---

`);

      expect(note.properties).toEqual({});
    });

    it('#1467 - should parse yaml frontmatter with colon in value', () => {
      const note = createNoteFromMarkdown(`
---
tags: test
source: https://example.com/page:123
---

# Note with colon in meta value\n`);
      expect(note.properties.source).toBe('https://example.com/page:123');
      expect(note.tags[0].label).toEqual('test');
    });
  });

  describe('Tags', () => {
    it('can find tags in the text of the note', () => {
      const noteA = createNoteFromMarkdown(`
# this is a #heading
#this is some #text that includes #tags we #care-about.
    `);
      expect(noteA.tags).toEqual([
        { label: 'heading', range: Range.create(1, 12, 1, 20) },
        { label: 'this', range: Range.create(2, 0, 2, 5) },
        { label: 'text', range: Range.create(2, 14, 2, 19) },
        { label: 'tags', range: Range.create(2, 34, 2, 39) },
        { label: 'care-about', range: Range.create(2, 43, 2, 54) },
      ]);
    });

    it('will skip tags in codeblocks', () => {
      const noteA = createNoteFromMarkdown(`
this is some #text that includes #tags we #care-about.

\`\`\`
this is a #codeblock
\`\`\`
    `);
      expect(noteA.tags.map(t => t.label)).toEqual([
        'text',
        'tags',
        'care-about',
      ]);
    });

    it('will skip tags in inlined codeblocks', () => {
      const noteA = createNoteFromMarkdown(`
this is some #text that includes #tags we #care-about.
this is a \`inlined #codeblock\` `);
      expect(noteA.tags.map(t => t.label)).toEqual([
        'text',
        'tags',
        'care-about',
      ]);
    });
    it('can find tags as text in yaml', () => {
      const noteA = createNoteFromMarkdown(`
---
tags: hello, world  this_is_good
---
# this is a heading
this is some #text that includes #tags we #care-about.
    `);
      expect(noteA.tags.map(t => t.label)).toEqual([
        'hello',
        'world',
        'this_is_good',
        'text',
        'tags',
        'care-about',
      ]);
    });

    it('can find tags as array in yaml', () => {
      const noteA = createNoteFromMarkdown(`
---
tags: [hello, world,  this_is_good]
---
# this is a heading
this is some #text that includes #tags we #care-about.
    `);
      expect(noteA.tags.map(t => t.label)).toEqual([
        'hello',
        'world',
        'this_is_good',
        'text',
        'tags',
        'care-about',
      ]);
    });

    it('provides a specific range for tags in yaml', () => {
      // For now it's enough to just get the YAML block range
      // in the future we might want to be more specific

      const noteA = createNoteFromMarkdown(`
---
prop: hello world
tags: [hello, world, this_is_good]
another: i love the world
---
# this is a heading
this is some text
    `);
      expect(noteA.tags[0]).toEqual({
        label: 'hello',
        range: Range.create(3, 7, 3, 12),
      });
      expect(noteA.tags[1]).toEqual({
        label: 'world',
        range: Range.create(3, 14, 3, 19),
      });
      expect(noteA.tags[2]).toEqual({
        label: 'this_is_good',
        range: Range.create(3, 21, 3, 33),
      });

      const noteB = createNoteFromMarkdown(`
---
prop: hello world
tags: 
- hello
- world
- this_is_good
another: i love the world
---
# this is a heading
this is some text
            `);
      expect(noteB.tags[0]).toEqual({
        label: 'hello',
        range: Range.create(4, 2, 4, 7),
      });
      expect(noteB.tags[1]).toEqual({
        label: 'world',
        range: Range.create(5, 2, 5, 7),
      });
      expect(noteB.tags[2]).toEqual({
        label: 'this_is_good',
        range: Range.create(6, 2, 6, 14),
      });
    });
  });

  describe('Sections', () => {
    it('should find sections within the note', () => {
      const note = createNoteFromMarkdown(`
# Section 1

This is the content of section 1.

## Section 1.1

This is the content of section 1.1.

# Section 2

This is the content of section 2.
      `);
      expect(note.sections).toHaveLength(3);
      expect(note.sections[0].label).toEqual('Section 1');
      expect(note.sections[0].range).toEqual(Range.create(1, 0, 9, 0));
      expect(note.sections[1].label).toEqual('Section 1.1');
      expect(note.sections[1].range).toEqual(Range.create(5, 0, 9, 0));
      expect(note.sections[2].label).toEqual('Section 2');
      expect(note.sections[2].range).toEqual(Range.create(9, 0, 13, 0));
    });

    it('should support wikilinks and links in the section label', () => {
      const note = createNoteFromMarkdown(`
# Section with [[wikilink]]

This is the content of section with wikilink

## Section with [url](https://google.com)

This is the content of section with url`);
      expect(note.sections).toHaveLength(2);
      expect(note.sections[0].label).toEqual('Section with wikilink');
      expect(note.sections[1].label).toEqual('Section with url');
    });
  });

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
  describe('Alias', () => {
    it('can find tags in comma separated string', () => {
      const note = parser.parse(
        URI.file('/path/to/a'),
        `
---
alias: alias 1, alias 2   , alias3 
---
This is a test note without headings.
But with some content.
`
      );
      expect(note.aliases).toEqual([
        {
          range: Range.create(1, 0, 3, 3),
          title: 'alias 1',
        },
        {
          range: Range.create(1, 0, 3, 3),
          title: 'alias 2',
        },
        {
          range: Range.create(1, 0, 3, 3),
          title: 'alias3',
        },
      ]);
    });
  });
  it('can find tags in yaml array', () => {
    const note = parser.parse(
      URI.file('/path/to/a'),
      `
---
alias:
- alias 1
- alias 2
- alias3
---
This is a test note without headings.
But with some content.
`
    );
    expect(note.aliases).toEqual([
      {
        range: Range.create(1, 0, 6, 3),
        title: 'alias 1',
      },
      {
        range: Range.create(1, 0, 6, 3),
        title: 'alias 2',
      },
      {
        range: Range.create(1, 0, 6, 3),
        title: 'alias3',
      },
    ]);
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

describe('Block ID range selection with identical lines', () => {
  const markdownWithIdenticalLines = `
> This is a blockquote.
> It has multiple lines.
> This is a blockquote.

^block-id-1

Some paragraph text.

> This is a blockquote.
> It has multiple lines.
> This is a blockquote.

^block-id-2

Another paragraph.

- List item 1
- List item 2 ^list-id-1

- List item 1
- List item 2 ^list-id-2

\`\`\`
Code block line 1
Code block line 2
\`\`\`

^code-id-1

\`\`\`
Code block line 1
Code block line 2
\`\`\`

^code-id-2
`;

  it('should correctly select the range for blockquote with identical lines', () => {
    const note = createNoteFromMarkdown(markdownWithIdenticalLines);
    const blockId1Section = note.sections.find(s => s.label === '^block-id-1');
    expect(blockId1Section).toBeDefined();
    expect(blockId1Section.range).toEqual(Range.create(1, 0, 3, 23));

    const blockId2Section = note.sections.find(s => s.label === '^block-id-2');
    expect(blockId2Section).toBeDefined();
    expect(blockId2Section.range).toEqual(Range.create(9, 0, 11, 23));
  });

  it('should correctly select the range for list item with identical lines', () => {
    const note = createNoteFromMarkdown(markdownWithIdenticalLines);
    const listId1Section = note.sections.find(s => s.label === '^list-id-1');
    expect(listId1Section).toBeDefined();
    expect(listId1Section.range).toEqual(Range.create(18, 0, 18, 24));

    const listId2Section = note.sections.find(s => s.label === '^list-id-2');
    expect(listId2Section).toBeDefined();
    expect(listId2Section.range).toEqual(Range.create(21, 0, 21, 24));
  });

  it('should correctly select the range for code block with identical lines', () => {
    const note = createNoteFromMarkdown(markdownWithIdenticalLines);
    const codeId1Section = note.sections.find(s => s.label === '^code-id-1');
    expect(codeId1Section).toBeDefined();
    expect(codeId1Section.range).toEqual(Range.create(23, 0, 26, 3));

    const codeId2Section = note.sections.find(s => s.label === '^code-id-2');
    expect(codeId2Section).toBeDefined();
    expect(codeId2Section.range).toEqual(Range.create(30, 0, 33, 3));
  });
});
