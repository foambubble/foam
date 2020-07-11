import { NoteGraph, Note } from '../src/core'
import { createNoteFromMarkdown } from '../src/utils/utils'

describe('Note graph', () => {
  it('Adds notes to graph', () => {
    const graph = new NoteGraph()
    graph.setNote(new Note('page-a', 'page-a', [], '/page-a.md', ''))
    graph.setNote(new Note('page-b', 'page-b', [], '/page-b.md', ''))
    graph.setNote(new Note('page-c', 'page-c', [], '/page-c.md', ''))

    expect(graph.getNotes().map(n => n.id).sort()).toEqual(['page-a', 'page-b', 'page-c'])
  })

  it('Detects forward links', () => {
    const graph = new NoteGraph()
    graph.setNote(new Note('page-a', 'page-a', [], '/page-a.md', ''))
    graph.setNote(new Note('page-b', 'page-b', [{to: 'page-a', text: 'go'}], '/page-b.md', ''))
    graph.setNote(new Note('page-c', 'page-c', [], '/page-c.md', ''))

    expect(graph.getForwardLinks('page-b').map(link => link.to).sort()).toEqual(['page-a'])
  })

  it('Detects backlinks', () => {
    const graph = new NoteGraph()
    graph.setNote(new Note('page-a', 'page-a', [], '/page-a.md', ''))
    graph.setNote(new Note('page-b', 'page-b', [{to: 'page-a', text: 'go'}], '/page-b.md', ''))
    graph.setNote(new Note('page-c', 'page-c', [], '/page-c.md', ''))

    expect(graph.getBacklinks('page-a').map(link => link.from).sort()).toEqual(['page-b'])
  })

  it('Fails when accessing non-existing node', () => {
    expect(() => {
      const graph = new NoteGraph()
      graph.setNote(new Note('page-a', 'page-a', [], '/path-b.md', ''))
      graph.getNote('non-existing')
    }).toThrow()
  })

  it('Updates links when modifying note', () => {
    const graph = new NoteGraph()
    graph.setNote(new Note('page-a', 'page-a', [], '/page-a.md', ''))
    graph.setNote(new Note('page-b', 'page-b', [{to: 'page-a', text: 'go'}], '/page-b.md', ''))
    graph.setNote(new Note('page-c', 'page-c', [], '/page-c.md', ''))

    expect(graph.getForwardLinks('page-b').map(link => link.to).sort()).toEqual(['page-a'])
    expect(graph.getBacklinks('page-a').map(link => link.from).sort()).toEqual(['page-b'])
    expect(graph.getBacklinks('page-c').map(link => link.from).sort()).toEqual([])

    graph.setNote(new Note('page-b', 'page-b', [{to: 'page-c', text: 'go'}], '/path-2b.md', ''))

    expect(graph.getForwardLinks('page-b').map(link => link.to).sort()).toEqual(['page-c'])
    expect(graph.getBacklinks('page-a').map(link => link.from).sort()).toEqual([])
    expect(graph.getBacklinks('page-c').map(link => link.from).sort()).toEqual(['page-b'])
  })

})


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
