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

describe('WorkspaceManager', () => {
  it('finds top level headings', () => {
    const titleA = parseNoteTitleFromMarkdown(pageA);
    const titleB = parseNoteTitleFromMarkdown(pageB);
    const titleC = parseNoteTitleFromMarkdown(pageC);

    expect(titleA).toEqual('Page A');
    expect(titleB).toEqual('Page B');
    expect(titleC).toBeNull();
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
