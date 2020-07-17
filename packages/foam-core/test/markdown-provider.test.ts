import { createNoteFromMarkdown, createMarkdownReferences } from '../src/markdown-provider';
import { NoteGraph } from '../src/note-graph';

const pageA = `
# Page A

## Section
- [[page-b]]
- [[page-c]]
`;

const pageB = `
# Page B

This references [[page-a]]`;

const pageC = `
# Page C
`;

describe('Markdown loader', () => {
  it('Converts markdown to notes', () => {
    const graph = new NoteGraph();
    graph.setNote(createNoteFromMarkdown('page-a', pageA));
    graph.setNote(createNoteFromMarkdown('page-b', pageB));
    graph.setNote(createNoteFromMarkdown('page-c', pageC));

    expect(
      graph
        .getNotes()
        .map(n => n.id)
        .sort()
    ).toEqual(['page-a', 'page-b', 'page-c']);
  });

  it('Parses wikilinks correctly', () => {
    const graph = new NoteGraph();
    graph.setNote(createNoteFromMarkdown('page-a', pageA));
    graph.setNote(createNoteFromMarkdown('page-b', pageB));
    graph.setNote(createNoteFromMarkdown('page-c', pageC));

    expect(graph.getBacklinks('page-b').map(link => link.from)).toEqual([
      'page-a',
    ]);
    expect(graph.getForwardLinks('page-a').map(link => link.to)).toEqual([
      'page-b',
      'page-c',
    ]);
  });
});

describe('wikilinks definitions', () => {
  it('can include or not the extension', () => {
    const graph = new NoteGraph();
    const noteA = createNoteFromMarkdown('dir1/page-a.md', pageA)
    const noteB = createNoteFromMarkdown('dir1/page-b.md', pageB)
    const noteC = createNoteFromMarkdown('dir1/page-c.md', pageC)
    graph.setNote(noteA);
    graph.setNote(noteB);
    graph.setNote(noteC);

    const noExtRefs = createMarkdownReferences(graph, noteA.id, false)
    expect(noExtRefs.map(r => r.wikiLink)).toEqual(['page-b', 'page-c'])

    const extRefs = createMarkdownReferences(graph, noteA.id, true)
    expect(extRefs.map(r => r.wikiLink)).toEqual(['page-b.md', 'page-c.md'])
  });

  it('use relative paths', () => {
    const graph = new NoteGraph();
    const noteA = createNoteFromMarkdown('dir1/page-a.md', pageA)
    const noteB = createNoteFromMarkdown('dir2/page-b.md', pageB)
    const noteC = createNoteFromMarkdown('dir3/page-c.md', pageC)
    graph.setNote(noteA);
    graph.setNote(noteB);
    graph.setNote(noteC);

    const extRefs = createMarkdownReferences(graph, noteA.id, true)
    expect(extRefs.map(r => r.wikiLink)).toEqual(['../dir2/page-b.md', '../dir3/page-c.md'])
  });
})
