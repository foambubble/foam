/* eslint-disable no-console */
import { URI } from './uri';
import { Range } from './range';
import { createMarkdownParser } from '../services/markdown-parser';
import { Logger } from '../utils/log';

Logger.setLevel('error');

const parser = createMarkdownParser();
const parse = (markdown: string) =>
  parser.parse(URI.parse('test-note.md'), markdown);

describe('Markdown Parser - Block Identifiers', () => {
  describe('Inline Block IDs', () => {
    it('should parse a block ID on a simple paragraph', () => {
      const markdown = `
This is a paragraph. ^block-id-1
`;
      const actual = parse(markdown);
      expect(actual.sections).toEqual([
        {
          id: 'block-id-1',
          label: 'This is a paragraph. ^block-id-1',
          blockId: '^block-id-1',
          isHeading: false,
          range: Range.create(1, 0, 1, 32),
        },
      ]);
    });

    it('should parse a block ID on a heading', () => {
      const markdown = `
## My Heading ^heading-id
`;
      const actual = parse(markdown);
      expect(actual.sections).toEqual([
        {
          id: 'my-heading', // PRD: slugified header text
          blockId: '^heading-id',
          isHeading: true,
          label: 'My Heading',
          range: Range.create(1, 0, 2, 0),
        },
      ]);
    });

    it('should parse a block ID on a list item', () => {
      const markdown = `
- List item one ^list-id-1
`;
      const actual = parse(markdown);
      expect(actual.sections).toEqual([
        {
          id: 'list-id-1',
          blockId: '^list-id-1',
          isHeading: false,
          label: '- List item one ^list-id-1',
          range: Range.create(1, 0, 1, 26),
        },
      ]);
    });

    it('should verify "last one wins" rule for inline block IDs', () => {
      const markdown = `
This is a paragraph. ^first-id ^second-id
`;
      const actual = parse(markdown);
      expect(actual.sections).toEqual([
        {
          id: 'second-id',
          blockId: '^second-id',
          label: 'This is a paragraph. ^first-id ^second-id',
          isHeading: false,
          range: Range.create(1, 0, 1, 41),
        },
      ]);
    });
  });

  describe('Full-line Block IDs', () => {
    it('should parse a full-line block ID on a blockquote', () => {
      const markdown = `
> This is a blockquote.
> It can span multiple lines.
^blockquote-id
`;
      const actual = parse(markdown);
      expect(actual.sections).toEqual([
        {
          id: 'blockquote-id',
          blockId: '^blockquote-id',
          isHeading: false,
          label: `> This is a blockquote.
> It can span multiple lines.`,
          range: Range.create(1, 0, 2, 28),
        },
      ]);
    });

    it('should parse a full-line block ID on a code block', () => {
      const markdown = `
\`\`\`typescript
function hello() {
  console.log('Hello, world!');
}
\`\`\`
^code-block-id
`;
      const actual = parse(markdown);
      expect(actual.sections).toEqual([
        {
          id: 'code-block-id',
          blockId: '^code-block-id',
          isHeading: false,
          label: `\`\`\`typescript
function hello() {
  console.log('Hello, world!');
}
\`\`\``,
          range: Range.create(1, 0, 5, 3),
        },
      ]);
    });

    it('should parse a full-line block ID on a table', () => {
      const markdown = `
| Header 1 | Header 2 |
| -------- | -------- |
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |
^my-table
`;
      const actual = parse(markdown);
      expect(actual.sections).toEqual([
        {
          id: 'my-table',
          blockId: '^my-table',
          isHeading: false,
          label: `| Header 1 | Header 2 |
| -------- | -------- |
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |`,
          range: Range.create(1, 0, 4, 23),
        },
      ]);
    });

    it('should parse a full-line block ID on a list', () => {
      const markdown = `- list item 1
- list item 2
^list-id`;
      const actual = parse(markdown);
      expect(actual.sections).toEqual([
        {
          id: 'list-id',
          blockId: '^list-id',
          label: `- list item 1
- list item 2`,
          isHeading: false,
          range: Range.create(0, 0, 1, 13),
        },
      ]);
    });

    it('should verify "last one wins" rule for full-line block IDs', () => {
      const markdown = `
- list item 1
- list item 2
^old-list-id ^new-list-id
`;
      const actual = parse(markdown);
      expect(actual.sections).toEqual([
        {
          id: 'new-list-id',
          blockId: '^new-list-id',
          label: `- list item 1
- list item 2`,
          isHeading: false,
          range: Range.create(1, 0, 2, 13),
        },
      ]);
    });
  });

  describe('Edge Cases', () => {
    it('should parse a block ID on a parent list item with sub-items', () => {
      const markdown = `
- Parent item ^parent-id
  - Child item 1
  - Child item 2
`;
      const actual = parse(markdown);
      expect(actual.sections).toEqual([
        {
          id: 'parent-id',
          blockId: '^parent-id',
          isHeading: false,
          label: `- Parent item ^parent-id
  - Child item 1
  - Child item 2`,
          range: Range.create(1, 0, 3, 16),
        },
      ]);
    });

    it('should parse a block ID on a nested list item', () => {
      const markdown = `
- Parent item
  - Child item 1 ^child-id-1
  - Child item 2
`;
      const actual = parse(markdown);
      expect(actual.sections).toEqual([
        {
          id: 'child-id-1',
          blockId: '^child-id-1',
          isHeading: false,
          label: '- Child item 1 ^child-id-1',
          range: Range.create(2, 2, 2, 28),
        },
      ]);
    });

    it('should verify duplicate prevention for nested list items with IDs', () => {
      const markdown = `
- Parent item ^parent-id
  - Child item 1 ^child-id
`;
      const actual = parse(markdown);
      expect(actual.sections).toEqual([
        {
          id: 'parent-id',
          blockId: '^parent-id',
          label: `- Parent item ^parent-id
  - Child item 1 ^child-id`,
          isHeading: false,
          range: Range.create(1, 0, 2, 26),
        },
      ]);
    });

    it('should not create a section if an empty line separates block from ID', () => {
      const markdown = `
- list item1
- list item2

^this-will-not-work
`;
      const actual = parse(markdown);
      expect(actual.sections).toEqual([]);
    });
  });
});
