import {
  createNoteFromMarkdown,
  createMarkdownReferences,
} from '../src/markdown-provider';
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

// @todo: Add tests for definitions
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
