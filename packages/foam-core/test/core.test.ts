import { NoteGraph, Note } from '../src/note-graph';

const position = {
  start: { line: 0, column: 0},
  end: { line: 0, column: 0}
};

describe('Note graph', () => {
  it('Adds notes to graph', () => {
    const graph = new NoteGraph();
    graph.setNote(new Note('page-a', 'page-a', [], '/page-a.md', ''));
    graph.setNote(new Note('page-b', 'page-b', [], '/page-b.md', ''));
    graph.setNote(new Note('page-c', 'page-c', [], '/page-c.md', ''));

    expect(
      graph
        .getNotes()
        .map(n => n.id)
        .sort()
    ).toEqual(['page-a', 'page-b', 'page-c']);
  });

  it('Detects forward links', () => {
    const graph = new NoteGraph();
    graph.setNote(new Note('page-a', 'page-a', [], '/page-a.md', ''));
    graph.setNote(
      new Note(
        'page-b',
        'page-b',
        [{ to: 'page-a', text: 'go', position }],
        '/page-b.md',
        ''
      )
    );
    graph.setNote(new Note('page-c', 'page-c', [], '/page-c.md', ''));

    expect(
      graph
        .getForwardLinks('page-b')
        .map(link => link.to)
        .sort()
    ).toEqual(['page-a']);
  });

  it('Detects backlinks', () => {
    const graph = new NoteGraph();
    graph.setNote(new Note('page-a', 'page-a', [], '/page-a.md', ''));
    graph.setNote(
      new Note(
        'page-b',
        'page-b',
        [{ to: 'page-a', text: 'go', position }],
        '/page-b.md',
        ''
      )
    );
    graph.setNote(new Note('page-c', 'page-c', [], '/page-c.md', ''));

    expect(
      graph
        .getBacklinks('page-a')
        .map(link => link.from)
        .sort()
    ).toEqual(['page-b']);
  });

  it('Fails when accessing non-existing node', () => {
    expect(() => {
      const graph = new NoteGraph();
      graph.setNote(new Note('page-a', 'page-a', [], '/path-b.md', ''));
      graph.getNote('non-existing');
    }).toThrow();
  });

  it('Allows adding edges to non-existing documents', () => {
    const graph = new NoteGraph();
    graph.setNote(
      new Note(
        'page-a',
        'page-a',
        [{ to: 'non-existing', text: 'does not exist', position }],
        '/path-b.md',
        ''
      )
    );
    expect(graph.getNote('non-existing')).toBeUndefined();
  });

  it('Updates links when modifying note', () => {
    const graph = new NoteGraph();
    graph.setNote(new Note('page-a', 'page-a', [], '/page-a.md', ''));
    graph.setNote(
      new Note(
        'page-b',
        'page-b',
        [{ to: 'page-a', text: 'go', position }],
        '/page-b.md',
        ''
      )
    );
    graph.setNote(new Note('page-c', 'page-c', [], '/page-c.md', ''));

    expect(
      graph
        .getForwardLinks('page-b')
        .map(link => link.to)
        .sort()
    ).toEqual(['page-a']);
    expect(
      graph
        .getBacklinks('page-a')
        .map(link => link.from)
        .sort()
    ).toEqual(['page-b']);
    expect(
      graph
        .getBacklinks('page-c')
        .map(link => link.from)
        .sort()
    ).toEqual([]);

    graph.setNote(
      new Note(
        'page-b',
        'page-b',
        [{ to: 'page-c', text: 'go', position }],
        '/path-2b.md',
        ''
      )
    );

    expect(
      graph
        .getForwardLinks('page-b')
        .map(link => link.to)
        .sort()
    ).toEqual(['page-c']);
    expect(
      graph
        .getBacklinks('page-a')
        .map(link => link.from)
        .sort()
    ).toEqual([]);
    expect(
      graph
        .getBacklinks('page-c')
        .map(link => link.from)
        .sort()
    ).toEqual(['page-b']);
  });
});
