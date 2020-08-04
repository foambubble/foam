import { NoteGraph, NoteLinkDefinition, NoteInfo } from '../src/note-graph';

const position = {
  start: { line: 1, column: 1 },
  end: { line: 1, column: 1 },
};

const documentStart = position.start;
const documentEnd = position.end;
const eol = '\n';

const createTestNote = (params: {
  uri: string;
  title?: string;
  definitions?: NoteLinkDefinition[];
  links?: { slug: string }[];
  text?: string;
}): NoteInfo => {
  return {
    properties: {},
    title: params.title ?? null,
    definitions: params.definitions ?? [],
    links: params.links
      ? params.links.map(link => ({
          type: 'wikilink',
          slug: link.slug,
          position: position,
          text: 'link text',
        }))
      : [],
    source: {
      eol: eol,
      end: documentEnd,
      contentStart: documentStart,
      uri: params.uri,
      text: params.text ?? '',
    },
  };
};

describe('Note graph', () => {
  it('Adds notes to graph', () => {
    const graph = new NoteGraph();
    graph.setNote(createTestNote({ uri: '/page-a.md' }));
    graph.setNote(createTestNote({ uri: '/page-b.md' }));
    graph.setNote(createTestNote({ uri: '/page-c.md' }));

    expect(
      graph
        .getNotes()
        .map(n => n.slug)
        .sort()
    ).toEqual(['page-a', 'page-b', 'page-c']);
  });

  it('Detects forward links', () => {
    const graph = new NoteGraph();
    graph.setNote(createTestNote({ uri: '/page-a.md' }));
    graph.setNote(
      createTestNote({
        uri: '/page-b.md',
        links: [{ slug: 'page-a' }],
      })
    );
    graph.setNote(createTestNote({ uri: '/page-c.md' }));

    expect(
      graph
        .getForwardLinks({ slug: 'page-b' })
        .map(link => graph.getNote({ id: link.to })!.slug)
    ).toEqual(['page-a']);
  });

  it('Detects backlinks', () => {
    const graph = new NoteGraph();
    graph.setNote(createTestNote({ uri: '/page-a.md' }));
    graph.setNote(
      createTestNote({
        uri: '/page-b.md',
        links: [{ slug: 'page-a' }],
      })
    );
    graph.setNote(createTestNote({ uri: '/page-c.md' }));

    expect(
      graph
        .getBacklinks({ slug: 'page-a' })
        .map(link => graph.getNote({ id: link.from })!.slug)
    ).toEqual(['page-b']);
  });

  it('Returns null when accessing non-existing node', () => {
    const graph = new NoteGraph();
    graph.setNote(createTestNote({ uri: 'page-a' }));
    expect(graph.getNote({ slug: 'non-existing' })).toBeNull();
  });

  it('Allows adding edges to non-existing documents', () => {
    const graph = new NoteGraph();
    graph.setNote(
      createTestNote({
        uri: '/page-a.md',
        links: [{ slug: 'non-existing' }],
      })
    );

    expect(graph.getNote({ slug: 'non-existing' })).toBeNull();
  });

  it('Updates links when modifying note', () => {
    const graph = new NoteGraph();
    graph.setNote(createTestNote({ uri: '/page-a.md' }));
    graph.setNote(
      createTestNote({
        uri: '/page-b.md',
        links: [{ slug: 'page-a' }],
      })
    );
    graph.setNote(createTestNote({ uri: '/page-c.md' }));

    expect(
      graph
        .getForwardLinks({ slug: 'page-b' })
        .map(link => graph.getNote({ id: link.to })?.slug)
    ).toEqual(['page-a']);
    expect(
      graph
        .getBacklinks({ slug: 'page-a' })
        .map(link => graph.getNote({ id: link.from })?.slug)
    ).toEqual(['page-b']);
    expect(
      graph
        .getBacklinks({ slug: 'page-c' })
        .map(link => graph.getNote({ id: link.from })?.slug)
    ).toEqual([]);

    graph.setNote(
      createTestNote({
        uri: '/page-b.md',
        links: [{ slug: 'page-c' }],
      })
    );

    expect(
      graph
        .getForwardLinks({ slug: 'page-b' })
        .map(link => graph.getNote({ id: link.to })?.slug)
    ).toEqual(['page-c']);
    expect(
      graph
        .getBacklinks({ slug: 'page-a' })
        .map(link => graph.getNote({ id: link.from })?.slug)
    ).toEqual([]);
    expect(
      graph
        .getBacklinks({ slug: 'page-c' })
        .map(link => graph.getNote({ id: link.from })?.slug)
    ).toEqual(['page-b']);
  });
});

describe('Graph querying', () => {
  it('can find notes by id', () => {
    const graph = new NoteGraph();
    const note = graph.setNote(createTestNote({ uri: '/page-a.md' }));
    expect(graph.getNote({ id: note.id })!.source.uri).toEqual('/page-a.md');
  });

  it('returns null if no note is found', () => {
    const graph = new NoteGraph();
    graph.setNote(createTestNote({ uri: '/page-a.md' }));
    expect(graph.getNote({ id: 'non-existing' })).toBeNull();
    expect(graph.getNote({ slug: 'non-existing' })).toBeNull();
    expect(graph.getNote({ title: 'non-existing' })).toBeNull();
    expect(graph.getNote({ uri: 'non-existing' })).toBeNull();
  });

  it('finds the note by uri', () => {
    const graph = new NoteGraph();
    const note = graph.setNote(createTestNote({ uri: '/page-a.md' }));
    expect(graph.getNote({ uri: '/page-a.md' })!.source.uri).toEqual(
      '/page-a.md'
    );
  });

  it('finds the note by slug', () => {
    const graph = new NoteGraph();
    const note = graph.setNote(createTestNote({ uri: '/page-a.md' }));
    expect(graph.getNote({ slug: note.slug })!.source.uri).toEqual(
      '/page-a.md'
    );
  });

  it('finds a note by slug when there is more than one', () => {
    const graph = new NoteGraph();
    graph.setNote(createTestNote({ uri: '/dir1/page-a.md' }));
    graph.setNote(createTestNote({ uri: '/dir2/page-a.md' }));
    expect(graph.getNote({ slug: 'page-a' })).toBeTruthy();
  });

  it('finds a note by title', () => {
    const graph = new NoteGraph();
    graph.setNote(
      createTestNote({ uri: '/dir1/page-a.md', title: 'My Title' })
    );
    expect(graph.getNote({ title: 'My Title' })!.source.uri).toEqual(
      '/dir1/page-a.md'
    );
  });

  it('finds a note by title when there are several', () => {
    const graph = new NoteGraph();
    graph.setNote(
      createTestNote({ uri: '/dir1/page-a.md', title: 'My Title' })
    );
    graph.setNote(
      createTestNote({ uri: '/dir3/page-b.md', title: 'My Title' })
    );
    expect(graph.getNote({ title: 'My Title' })).toBeTruthy();
  });
});
