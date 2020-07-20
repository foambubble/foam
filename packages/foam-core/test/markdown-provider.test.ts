import {
  createNoteFromMarkdown,
  createMarkdownReferences,
} from '../src/markdown-provider';
import { NoteGraph, Note } from '../src/note-graph';

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

const pageD = `
This file has no heading.
`

describe('Markdown loader', () => {
  it('Converts markdown to notes', () => {
    const graph = new NoteGraph();
    graph.setNote(createNoteFromMarkdown('page-a', pageA, '\n'));
    graph.setNote(createNoteFromMarkdown('page-b', pageB, '\n'));
    graph.setNote(createNoteFromMarkdown('page-c', pageC, '\n'));

    expect(
      graph
        .getNotes()
        .map(n => n.id)
        .sort()
    ).toEqual(['page-a', 'page-b', 'page-c']);
  });

  it('Parses wikilinks correctly', () => {
    const graph = new NoteGraph();
    graph.setNote(createNoteFromMarkdown('page-a', pageA, '\n'));
    graph.setNote(createNoteFromMarkdown('page-b', pageB, '\n'));
    graph.setNote(createNoteFromMarkdown('page-c', pageC, '\n'));

    expect(graph.getBacklinks('page-b').map(link => link.from)).toEqual([
      'page-a',
    ]);
    expect(graph.getForwardLinks('page-a').map(link => link.to)).toEqual([
      'page-b',
      'page-c',
    ]);
  });
});

describe('Note Title', () => {
  it('should initialize note title if heading exists', () => {
    const graph = new NoteGraph();
    graph.setNote(createNoteFromMarkdown('page-a', pageA, '\n'));

    const pageANoteTitle = (graph.getNote('page-a') as Note).title;
    expect(pageANoteTitle).toBe('Page A');
  });

  it('should not initialize note title if heading does not exist', () => {
    const graph = new NoteGraph();
    graph.setNote(createNoteFromMarkdown('page-d', pageD, '\n'));

    const pageANoteTitle = (graph.getNote('page-d') as Note).title;
    expect(pageANoteTitle).toBe(null);
  });
})

describe('wikilinks definitions', () => {
  it('can generate links without file extension when includeExtension = false', () => {
    const graph = new NoteGraph();
    const noteA = createNoteFromMarkdown('dir1/page-a.md', pageA, '\n');
    const noteB = createNoteFromMarkdown('dir1/page-b.md', pageB, '\n');
    const noteC = createNoteFromMarkdown('dir1/page-c.md', pageC, '\n');
    graph.setNote(noteA);
    graph.setNote(noteB);
    graph.setNote(noteC);

    const noExtRefs = createMarkdownReferences(graph, noteA.id, false);
    expect(noExtRefs.map(r => r.url)).toEqual(['page-b', 'page-c']);
  });

  it('can generate links with file extension when includeExtension = true', () => {
    const graph = new NoteGraph();
    const noteA = createNoteFromMarkdown('dir1/page-a.md', pageA, '\n');
    const noteB = createNoteFromMarkdown('dir1/page-b.md', pageB, '\n');
    const noteC = createNoteFromMarkdown('dir1/page-c.md', pageC, '\n');
    graph.setNote(noteA);
    graph.setNote(noteB);
    graph.setNote(noteC);

    const extRefs = createMarkdownReferences(graph, noteA.id, true);
    expect(extRefs.map(r => r.url)).toEqual(['page-b.md', 'page-c.md']);
  });

  it('use relative paths', () => {
    const graph = new NoteGraph();
    const noteA = createNoteFromMarkdown('dir1/page-a.md', pageA, '\n');
    const noteB = createNoteFromMarkdown('dir2/page-b.md', pageB, '\n');
    const noteC = createNoteFromMarkdown('dir3/page-c.md', pageC, '\n');
    graph.setNote(noteA);
    graph.setNote(noteB);
    graph.setNote(noteC);

    const extRefs = createMarkdownReferences(graph, noteA.id, true);
    expect(extRefs.map(r => r.url)).toEqual([
      '../dir2/page-b.md',
      '../dir3/page-c.md',
    ]);
  });
});
