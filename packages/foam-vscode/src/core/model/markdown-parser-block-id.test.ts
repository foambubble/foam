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
          type: 'block',
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
          id: 'my-heading',
          blockId: '^heading-id',
          type: 'heading',
          label: 'My Heading',
          level: 2, // Add level property
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
          type: 'block',
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
          type: 'block',
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
          type: 'block',
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
          type: 'block',
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
          type: 'block',
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
          type: 'block',
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
          type: 'block',
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
          type: 'block',
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
          type: 'block',
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
          type: 'block',
          label: `- Parent item ^parent-id
  - Child item 1 ^child-id`,
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

  describe('Complex List Scenarios', () => {
    it('should correctly parse an inline block ID on a specific list item', () => {
      const markdown = `- item 1
- item 2 ^list-item-id
- item 3`;
      const actual = parse(markdown);
      expect(actual.sections).toEqual([
        {
          id: 'list-item-id',
          blockId: '^list-item-id',
          type: 'block',
          label: '- item 2 ^list-item-id',
          range: Range.create(1, 0, 1, 22),
        },
      ]);
    });

    it('should ignore a child list item ID when a parent list item has an ID', () => {
      const markdown = `- parent item ^parent-id
  - child item ^child-id`;
      const actual = parse(markdown);
      expect(actual.sections).toEqual([
        {
          id: 'parent-id',
          blockId: '^parent-id',
          type: 'block',
          label: `- parent item ^parent-id
  - child item ^child-id`,
          range: Range.create(0, 0, 1, 24),
        },
      ]);
    });

    it('should create sections for both a full-list ID and a list item ID', () => {
      const markdown = `- item 1 ^inline-id
- item 2
^list-id`;
      const actual = parse(markdown);
      expect(actual.sections).toEqual(
        expect.arrayContaining([
          {
            id: 'list-id',
            blockId: '^list-id',
            type: 'block',
            label: `- item 1 ^inline-id
- item 2`,
            range: Range.create(0, 0, 1, 8),
          },
          {
            id: 'inline-id',
            blockId: '^inline-id',
            type: 'block',
            label: '- item 1 ^inline-id',
            range: Range.create(0, 0, 0, 19),
          },
        ])
      );
      expect(actual.sections.length).toBe(2);
    });

    it('should handle a mix of full-list, parent-item, and nullified child-item IDs', () => {
      const markdown = `- list item 1 ^parent-list-id
  - list item 2 ^child-list-id
^full-list-id`;
      const actual = parse(markdown);
      expect(actual.sections).toEqual(
        expect.arrayContaining([
          {
            id: 'full-list-id',
            blockId: '^full-list-id',
            type: 'block',
            label: `- list item 1 ^parent-list-id
  - list item 2 ^child-list-id`,
            range: Range.create(0, 0, 1, 31),
          },
          {
            id: 'parent-list-id',
            blockId: '^parent-list-id',
            type: 'block',
            label: `- list item 1 ^parent-list-id
  - list item 2 ^child-list-id`,
            range: Range.create(0, 0, 1, 31), // This range is for the parent item, which now correctly includes the child item due to the deepest child logic.
          },
        ])
      );
      expect(actual.sections.length).toBe(2);
    });
  });

  describe('Mixed Content Note Block IDs', () => {
    it('parses block IDs in a realistic mixed-content note', () => {
      const markdown = `
# Mixed Target Note

This note has a bit of everything.

Here is a paragraph with a block identifier. ^para-block

- List item 1
- List item 2 ^list-block
- List item 3

It also links to [[mixed-other]].
`;
      const actual = parse(markdown);
      expect(actual.sections).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'list-block',
            blockId: '^list-block',
            type: 'block',
            label: '- List item 2 ^list-block',
          }),
        ])
      );
    });
  });
});
