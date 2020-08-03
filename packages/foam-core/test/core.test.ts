import { NoteGraph, NoteLinkDefinition, NoteInfo } from '../src/note-graph';

const position = {
  start: { line: 1, column: 1 },
  end: { line: 0, column: 0 },
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
