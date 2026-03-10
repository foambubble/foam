import {
  createMarkdownParser,
  getBlockFor,
  ParserPlugin,
} from './markdown-parser';
import { NoteLinkDefinition, Resource, ResourceLink } from '../model/note';
import { Logger } from '../utils/log';
import { URI } from '../model/uri';
import { Range } from '../model/range';
import { getRandomURI } from '../../test/test-utils';
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

    it('should set reference to alias for wikilinks with alias', () => {
      const note = createNoteFromMarkdown(
        'This is a [[target-file|Display Name]] wikilink.'
      );
      expect(note.links.length).toEqual(1);
      const link = note.links[0];
      expect(link.type).toEqual('wikilink');
      expect(ResourceLink.isUnresolvedReference(link)).toBe(true);
      expect(link.definition).toEqual('target-file');
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

    it('#1545 - should not detect single brackets as links', () => {
      const note = createNoteFromMarkdown(`
"She said [winning the award] was her best year."

We use brackets ([ and ]) to surround links.

This is not an easy task.[^1]

[^1]: It would be easier if more papers were well written.
      `);
      expect(note.links.length).toEqual(0);
    });

    it('should detect reference-style links', () => {
      const note = createNoteFromMarkdown(`
# Test Document

This is a [reference-style link][ref1] and another [link][ref2].

[ref1]: target1.md "Target 1"
[ref2]: target2.md "Target 2"
      `);

      expect(note.links.length).toEqual(2);

      const link1 = note.links[0];
      expect(link1.type).toEqual('link');
      expect(link1.rawText).toEqual('[reference-style link][ref1]');
      expect(ResourceLink.isResolvedReference(link1)).toBe(true);
      const definition1 = link1.definition as NoteLinkDefinition;
      expect(definition1.label).toEqual('ref1');
      expect(definition1.url).toEqual('target1.md');
      expect(definition1.title).toEqual('Target 1');

      const link2 = note.links[1];
      expect(link2.type).toEqual('link');
      expect(link2.rawText).toEqual('[link][ref2]');
      expect(ResourceLink.isResolvedReference(link2)).toBe(true);
      const definition2 = link2.definition as NoteLinkDefinition;
      expect(definition2.label).toEqual('ref2');
      expect(definition2.url).toEqual('target2.md');
    });

    it('should handle reference-style links without matching definitions', () => {
      const note = createNoteFromMarkdown(`
This is a [reference-style link][missing-ref].

[existing-ref]: target.md "Target"
      `);

      // Per CommonMark spec, reference links without matching definitions
      // should be treated as plain text, not as links
      expect(note.links.length).toEqual(0);
    });

    it('should handle mixed link types', () => {
      const note = createNoteFromMarkdown(`
This has [[wikilink]], [inline link](target.md), and [reference link][ref].

[ref]: reference-target.md "Reference Target"
      `);

      expect(note.links.length).toEqual(3);

      expect(note.links[0].type).toEqual('wikilink');
      expect(note.links[0].rawText).toEqual('[[wikilink]]');
      expect(ResourceLink.isUnresolvedReference(note.links[0])).toBe(true);
      expect(note.links[0].definition).toEqual('wikilink');

      expect(note.links[1].type).toEqual('link');
      expect(note.links[1].rawText).toEqual('[inline link](target.md)');
      expect(ResourceLink.isReferenceStyleLink(note.links[1])).toBe(false);

      expect(note.links[2].type).toEqual('link');
      expect(note.links[2].rawText).toEqual('[reference link][ref]');
      expect(ResourceLink.isResolvedReference(note.links[2])).toBe(true);
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

describe('block anchor extraction', () => {
  it('should extract block anchor from a paragraph', () => {
    const note = parser.parse(
      URI.file('/path/note.md'),
      `This is a paragraph ^myblock`
    );
    expect(note.blocks).toHaveLength(1);
    expect(note.blocks[0].id).toBe('myblock');
    expect(note.blocks[0].type).toBe('paragraph');
    expect(note.blocks[0].range.start.line).toBe(0);
    expect(note.blocks[0].range.end.line).toBe(0);
  });

  it('should extract block anchor from a multi-line paragraph', () => {
    const note = parser.parse(
      URI.file('/path/note.md'),
      `Line one\nLine two ^multiblock`
    );
    expect(note.blocks).toHaveLength(1);
    expect(note.blocks[0].id).toBe('multiblock');
    expect(note.blocks[0].type).toBe('paragraph');
    expect(note.blocks[0].range.start.line).toBe(0);
    expect(note.blocks[0].range.end.line).toBe(1);
  });

  it('should support hyphens in block IDs', () => {
    const note = parser.parse(
      URI.file('/path/note.md'),
      `A paragraph ^my-block-id`
    );
    expect(note.blocks).toHaveLength(1);
    expect(note.blocks[0].id).toBe('my-block-id');
  });

  it('should extract block anchor from a list item, with range covering sub-items', () => {
    const note = parser.parse(
      URI.file('/path/note.md'),
      `- Parent item ^myblock\n  - Child 1\n  - Child 2\n- Another item`
    );
    const block = note.blocks.find(b => b.id === 'myblock');
    expect(block).toBeDefined();
    expect(block.type).toBe('list-item');
    // Range must cover all sub-items (lines 0-2, not just line 0)
    expect(block.range.start.line).toBe(0);
    expect(block.range.end.line).toBeGreaterThan(0);
  });

  it('should extract block anchor from a nested sub-item with range limited to its subtree', () => {
    const note = parser.parse(
      URI.file('/path/note.md'),
      `- Parent item\n  - Child ^childblock\n    - Grandchild\n- Another item`
    );
    const block = note.blocks.find(b => b.id === 'childblock');
    expect(block).toBeDefined();
    expect(block.type).toBe('list-item');
    expect(block.range.start.line).toBe(1);
    expect(block.range.end.line).toBeGreaterThan(1); // includes grandchild
    expect(block.range.end.line).toBeLessThan(3); // excludes "Another item"
  });

  it('should extract block anchor from a heading', () => {
    const note = parser.parse(
      URI.file('/path/note.md'),
      `## My Heading ^headingblock\n\nSome content`
    );
    const block = note.blocks.find(b => b.id === 'headingblock');
    expect(block).toBeDefined();
    expect(block.type).toBe('heading');
    // heading block range is just the heading line, not the section content
    expect(block.range.start.line).toBe(0);
    expect(block.range.end.line).toBe(0);
  });

  it('should strip ^id from section label when heading has a block anchor', () => {
    const note = parser.parse(
      URI.file('/path/note.md'),
      `## My Heading ^headingblock\n\nSome content`
    );
    expect(note.sections).toHaveLength(1);
    expect(note.sections[0].label).toBe('My Heading');
  });

  it('should extract block anchor from a blockquote', () => {
    const note = parser.parse(
      URI.file('/path/note.md'),
      `> This is a quote ^quoteblock`
    );
    const block = note.blocks.find(b => b.id === 'quoteblock');
    expect(block).toBeDefined();
    expect(block.type).toBe('blockquote');
    expect(block.range.start.line).toBe(0);
    expect(block.range.end.line).toBe(0);
  });

  it('should extract block anchor from a multi-line blockquote', () => {
    const note = parser.parse(
      URI.file('/path/note.md'),
      `> Line one\n> Line two ^quotemulti`
    );
    const block = note.blocks.find(b => b.id === 'quotemulti');
    expect(block).toBeDefined();
    expect(block.type).toBe('blockquote');
    expect(block.range.start.line).toBe(0);
    expect(block.range.end.line).toBe(1);
  });

  it('should extract multiple block anchors from a file', () => {
    const note = parser.parse(
      URI.file('/path/note.md'),
      `First paragraph ^first\n\nSecond paragraph ^second`
    );
    expect(note.blocks).toHaveLength(2);
    expect(note.blocks.map(b => b.id)).toEqual(['first', 'second']);
  });

  it('should not extract blocks from elements without ^id', () => {
    const note = parser.parse(
      URI.file('/path/note.md'),
      `Just a paragraph\n\n- A list item`
    );
    expect(note.blocks).toHaveLength(0);
  });

  it('should keep all occurrences when duplicate block IDs are present', () => {
    const note = parser.parse(
      URI.file('/path/note.md'),
      `First paragraph ^dup\n\nSecond paragraph ^dup`
    );
    expect(note.blocks).toHaveLength(2);
    expect(note.blocks[0].range.start.line).toBe(0);
    expect(note.blocks[1].range.start.line).toBe(2);
  });

  it('should use first-wins for duplicate block IDs when resolving', () => {
    const note = parser.parse(
      URI.file('/path/note.md'),
      `First paragraph ^dup\n\nSecond paragraph ^dup`
    );
    const found = Resource.findBlock(note, 'dup');
    expect(found).not.toBeNull();
    expect(found.range.start.line).toBe(0);
  });

  it('should register a list item block anchor only once (not once per node type)', () => {
    const note = parser.parse(
      URI.file('/path/note.md'),
      `- Item one ^listblock\n- Item two\n`
    );
    expect(note.blocks).toHaveLength(1);
    expect(note.blocks[0].id).toBe('listblock');
  });

  it('should register a list item anchor only once even when it has nested subitems', () => {
    const note = parser.parse(
      URI.file('/path/note.md'),
      `- this is item ^listblock\n  - subitem\n`
    );
    expect(note.blocks).toHaveLength(1);
    expect(note.blocks[0].id).toBe('listblock');
  });

  it('should register a blockquote block anchor only once (not once per node type)', () => {
    const note = parser.parse(
      URI.file('/path/note.md'),
      `> Quote text ^quoteblock\n`
    );
    expect(note.blocks).toHaveLength(1);
    expect(note.blocks[0].id).toBe('quoteblock');
    expect(note.blocks[0].type).toBe('blockquote');
  });

  it('should not extract footnote references as block anchors', () => {
    const note = parser.parse(
      URI.file('/path/note.md'),
      `A paragraph with a footnote[^1]\n\n[^1]: The footnote text`
    );
    expect(note.blocks).toHaveLength(0);
  });

  it('should not extract ^id from the middle of a paragraph', () => {
    const note = parser.parse(
      URI.file('/path/note.md'),
      `Text ^notanid more text after`
    );
    expect(note.blocks).toHaveLength(0);
  });

  it('should only accept valid block ID characters [a-zA-Z0-9-]', () => {
    const note = parser.parse(
      URI.file('/path/note.md'),
      `Valid ^valid-id-123\n\nInvalid ^invalid_id`
    );
    expect(note.blocks).toHaveLength(1);
    expect(note.blocks[0].id).toBe('valid-id-123');
  });

  describe('full-line block IDs (Obsidian-compatible)', () => {
    it('should extract a full-line block ID after a code fence', () => {
      const note = parser.parse(
        URI.file('/path/note.md'),
        '```js\nconsole.log("hi");\n```\n^mycode'
      );
      const block = note.blocks.find(b => b.id === 'mycode');
      expect(block).toBeDefined();
      expect(block.type).toBe('code');
      expect(block.range.start.line).toBe(0);
      expect(block.range.end.line).toBe(2);
    });

    it('should extract a full-line block ID after a table', () => {
      const note = parser.parse(
        URI.file('/path/note.md'),
        '| A | B |\n| - | - |\n| 1 | 2 |\n^mytable'
      );
      const block = note.blocks.find(b => b.id === 'mytable');
      expect(block).toBeDefined();
      expect(block.type).toBe('table');
      expect(block.range.start.line).toBe(0);
      expect(block.range.end.line).toBe(2);
    });

    it('should extract a full-line block ID after a list (full list anchoring)', () => {
      const note = parser.parse(
        URI.file('/path/note.md'),
        '- Item one\n- Item two\n- Item three\n^mylist'
      );
      const block = note.blocks.find(b => b.id === 'mylist');
      expect(block).toBeDefined();
      expect(block.type).toBe('list');
      expect(block.range.start.line).toBe(0);
      // Range should not include the ^id line
      expect(block.range.end.line).toBe(2);
    });

    it('should match a full-line block ID after code fence separated by one blank line', () => {
      const note = parser.parse(
        URI.file('/path/note.md'),
        '```js\ncode();\n```\n\n^mycode'
      );
      const block = note.blocks.find(b => b.id === 'mycode');
      expect(block).toBeDefined();
      expect(block.type).toBe('code');
    });

    it('should match a full-line block ID after table separated by one blank line', () => {
      const note = parser.parse(
        URI.file('/path/note.md'),
        '| A | B |\n| - | - |\n| 1 | 2 |\n\n^mytable'
      );
      const block = note.blocks.find(b => b.id === 'mytable');
      expect(block).toBeDefined();
      expect(block.type).toBe('table');
    });

    it('should not match a full-line block ID after code fence separated by two blank lines', () => {
      const note = parser.parse(
        URI.file('/path/note.md'),
        '```js\ncode();\n```\n\n\n^mycode'
      );
      expect(note.blocks.find(b => b.id === 'mycode')).toBeUndefined();
    });

    it('should not match a full-line block ID after table separated by two blank lines', () => {
      const note = parser.parse(
        URI.file('/path/note.md'),
        '| A | B |\n| - | - |\n| 1 | 2 |\n\n\n^mytable'
      );
      expect(note.blocks.find(b => b.id === 'mytable')).toBeUndefined();
    });

    it('should extract a full-line block ID right after a blockquote (lazy continuation, no blank line)', () => {
      const note = parser.parse(
        URI.file('/path/note.md'),
        '> First line\n> Second line\n^myquote'
      );
      const block = note.blocks.find(b => b.id === 'myquote');
      expect(block).toBeDefined();
      expect(block.type).toBe('blockquote');
      // Range should not include the ^id line
      expect(block.range.start.line).toBe(0);
      expect(block.range.end.line).toBe(1);
      // markerRange: line 2 (0-indexed), column 0 (^id on its own line)
      expect(block.markerRange.start.line).toBe(2);
      expect(block.markerRange.start.character).toBe(0);
      expect(block.markerRange.end.character).toBe(1 + 'myquote'.length); // "^myquote"
    });

    it('should extract a full-line block ID after a blockquote separated by one blank line', () => {
      const note = parser.parse(
        URI.file('/path/note.md'),
        '> First line\n> Second line\n\n^myquote'
      );
      const block = note.blocks.find(b => b.id === 'myquote');
      expect(block).toBeDefined();
      expect(block.type).toBe('blockquote');
      expect(block.range.start.line).toBe(0);
      expect(block.range.end.line).toBe(1);
    });

    it('should extract a full-line block ID as the last line inside a blockquote', () => {
      const note = parser.parse(
        URI.file('/path/note.md'),
        '> First line\n> Second line\n> ^myquote'
      );
      const block = note.blocks.find(b => b.id === 'myquote');
      expect(block).toBeDefined();
      expect(block.type).toBe('blockquote');
      // Range should not include the ^id line
      expect(block.range.start.line).toBe(0);
      expect(block.range.end.line).toBe(1);
      // markerRange: line 2 (0-indexed), columns 2-9 (after "> ")
      expect(block.markerRange.start.line).toBe(2);
      expect(block.markerRange.start.character).toBe(2); // after "> "
      expect(block.markerRange.end.line).toBe(2);
      expect(block.markerRange.end.character).toBe(2 + 1 + 'myquote'.length); // "^myquote"
    });

    it('should handle multiple full-line block IDs in the same document', () => {
      const note = parser.parse(
        URI.file('/path/note.md'),
        '```\ncode\n```\n^block1\n\n| A |\n| - |\n^block2'
      );
      const b1 = note.blocks.find(b => b.id === 'block1');
      const b2 = note.blocks.find(b => b.id === 'block2');
      expect(b1).toBeDefined();
      expect(b1.type).toBe('code');
      expect(b2).toBeDefined();
      expect(b2.type).toBe('table');
    });
  });
});
