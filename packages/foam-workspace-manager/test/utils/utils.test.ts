import {
  parseNoteTitleFromMarkdown,
  parseNoteLinksFromMarkdown,
} from '../../src/utils/utils';

const pageA = `
# Page A

## Section
- [[page-b]]
- [[page-c]]
`;

const pageB = `
# Page B
`;

const pageC = `
foo
bar
`;

const pageD = `
# Page D
hello world

# Another header
hello world
`;

describe('WorkspaceManager', () => {
  it('finds top level headings', () => {
    const titleA = parseNoteTitleFromMarkdown(pageA);
    const titleB = parseNoteTitleFromMarkdown(pageB);
    const titleC = parseNoteTitleFromMarkdown(pageC);
    const titleD = parseNoteTitleFromMarkdown(pageD);

    expect(titleA).toEqual('Page A');
    expect(titleB).toEqual('Page B');
    expect(titleC).toBeNull();
    // in case of multiple top level headings, the first one rules
    expect(titleD).toEqual('Page D');
  });

  it('finds wikilinks', () => {
    const linksA = parseNoteLinksFromMarkdown(pageA);
    const linksB = parseNoteLinksFromMarkdown(pageB);
    const linksC = parseNoteLinksFromMarkdown(pageC);

    expect(linksA).toEqual(['page-b', 'page-c']);
    expect(linksB).toEqual([]);
    expect(linksC).toEqual([]);
  });
});
