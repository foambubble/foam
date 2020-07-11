import { createNoteFromMarkdown } from "../src/markdown-provider";
import { NoteGraph } from "../src/core";

const pageA = `
# Page A

## Section
- [[page-b]]
- [[page-c]];
`;

const pageB = `
# Page B

This references [[page-a]]`;

const pageC = `
# Page C
`;

describe('Markdown loader', () => {
  it('Converts markdown to notes', () => {
    const graph = new NoteGraph()
    graph.setNote(createNoteFromMarkdown('page-a', pageA))
    graph.setNote(createNoteFromMarkdown('page-b', pageB))
    graph.setNote(createNoteFromMarkdown('page-c', pageC))

    expect(graph.getNotes().map(n => n.id).sort()).toEqual(['page-a', 'page-b', 'page-c'])
  })

  it('Parses wikilinks correctly', () => {
    const graph = new NoteGraph()
    graph.setNote(createNoteFromMarkdown('page-a', pageA))
    graph.setNote(createNoteFromMarkdown('page-b', pageB))
    graph.setNote(createNoteFromMarkdown('page-c', pageC))

    expect(graph.getBacklinks('page-b').map(link => link.from)).toEqual(['page-a'])
    expect(graph.getForwardLinks('page-a').map(link => link.to)).toEqual(['page-b', 'page-c'])
  })
})
