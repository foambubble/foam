import { URI } from './uri';
import { Range } from './range';
import { createMarkdownParser } from '../services/markdown-parser';
import { ResourceParser } from './note';

describe('Markdown Parser - Block Identifiers', () => {
  const parser: ResourceParser = createMarkdownParser();
  const uri = URI.parse('test-note.md');

  it('should parse a block ID on a simple paragraph', () => {
    const markdown = `
This is a paragraph. ^block-id-1
`;
    const resource = parser.parse(uri, markdown);

    expect(resource.sections).toHaveLength(1);
    const section = resource.sections[0];

    expect(section.id).toEqual('block-id-1');
    expect(section.label).toEqual('This is a paragraph. ^block-id-1');
    expect(section.blockId).toEqual('^block-id-1');
    expect(section.isHeading).toBeFalsy();
    expect(section.range).toEqual(Range.create(1, 0, 1, 32));
  });

  it('should parse a block ID on a heading', () => {
    const markdown = `
## My Heading ^heading-id
`;
    const resource = parser.parse(uri, markdown);

    expect(resource.sections).toHaveLength(1);
    const section = resource.sections[0];

    expect(section.id).toEqual('my-heading');
    expect(section.blockId).toEqual('heading-id');
    expect(section.isHeading).toBeTruthy();
    expect(section.label).toEqual('My Heading');
  });

  it('should parse a block ID on a list item', () => {
    const markdown = `
- List item one ^list-id-1
`;
    const resource = parser.parse(uri, markdown);

    expect(resource.sections).toHaveLength(1);
    const section = resource.sections[0];

    expect(section.id).toEqual('list-id-1');
    expect(section.blockId).toEqual('^list-id-1');
    expect(section.isHeading).toBeFalsy();
    expect(section.label).toEqual('- List item one ^list-id-1');
    expect(section.range).toEqual(Range.create(1, 0, 1, 26));
  });

  it('should parse a block ID on a parent list item with sub-items', () => {
    const markdown = `
- Parent item ^parent-id
  - Child item 1
  - Child item 2
`;
    const resource = parser.parse(uri, markdown);

    expect(resource.sections).toHaveLength(1);
    const section = resource.sections[0];

    expect(section.id).toEqual('parent-id');
    expect(section.blockId).toEqual('^parent-id');
    expect(section.isHeading).toBeFalsy();
    expect(section.label).toEqual(`- Parent item ^parent-id
  - Child item 1
  - Child item 2`);
    expect(section.range).toEqual(Range.create(1, 0, 3, 16));
  });

  it('should parse a block ID on a nested list item', () => {
    const markdown = `
- Parent item
  - Child item 1 ^child-id-1
  - Child item 2
`;
    const resource = parser.parse(uri, markdown);

    // This should eventually be 2, one for the parent and one for the child.
    // For now, we are just testing the child.
    const section = resource.sections.find(s => s.id === 'child-id-1');

    expect(section).toBeDefined();
    expect(section.blockId).toEqual('^child-id-1');
    expect(section.isHeading).toBeFalsy();
    expect(section.label).toEqual('- Child item 1 ^child-id-1');
    expect(section.range).toEqual(Range.create(2, 2, 2, 29));
  });
});
