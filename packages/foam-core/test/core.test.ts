import { NoteGraph, createGraph } from '../src/model/note-graph';
import { NoteLinkDefinition, Note } from '../src/types';
import { uriToSlug } from '../src/utils';
import { URI } from '../src/common/uri';
import { Logger } from '../src/utils/log';

Logger.setLevel('error');

const position = {
  start: { line: 1, column: 1 },
  end: { line: 1, column: 1 },
};

const documentStart = position.start;
const documentEnd = position.end;
const eol = '\n';

export const createTestNote = (params: {
  uri: string;
  title?: string;
  definitions?: NoteLinkDefinition[];
  links?: { slug: string }[];
  text?: string;
}): Note => {
  return {
    properties: {},
    title: params.title ?? null,
    slug: uriToSlug(URI.file(params.uri)),
    definitions: params.definitions ?? [],
    tags: new Set(),
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
      uri: URI.file(params.uri),
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
    const noteB = graph.setNote(
      createTestNote({
        uri: '/page-b.md',
        links: [{ slug: 'page-a' }],
      })
    );
    graph.setNote(createTestNote({ uri: '/page-c.md' }));

    expect(
      graph.getForwardLinks(noteB.id).map(link => graph.getNote(link.to)!.slug)
    ).toEqual(['page-a']);
  });

  it('Detects backlinks', () => {
    const graph = new NoteGraph();
    const noteA = graph.setNote(createTestNote({ uri: '/page-a.md' }));
    graph.setNote(
      createTestNote({
        uri: '/page-b.md',
        links: [{ slug: 'page-a' }],
      })
    );
    graph.setNote(createTestNote({ uri: '/page-c.md' }));

    expect(
      graph.getBacklinks(noteA.id).map(link => graph.getNote(link.from)!.slug)
    ).toEqual(['page-b']);
  });

  it('Returns null when accessing non-existing node', () => {
    const graph = new NoteGraph();
    graph.setNote(createTestNote({ uri: 'page-a' }));
    expect(graph.getNote('non-existing')).toBeNull();
  });

  it('Allows adding edges to non-existing documents', () => {
    const graph = new NoteGraph();
    graph.setNote(
      createTestNote({
        uri: '/page-a.md',
        links: [{ slug: 'non-existing' }],
      })
    );

    expect(graph.getNote('non-existing')).toBeNull();
  });

  it('Updates links when modifying note', () => {
    const graph = new NoteGraph();
    const noteA = graph.setNote(createTestNote({ uri: '/page-a.md' }));
    const noteB = graph.setNote(
      createTestNote({
        uri: '/page-b.md',
        links: [{ slug: 'page-a' }],
      })
    );
    const noteC = graph.setNote(createTestNote({ uri: '/page-c.md' }));

    expect(
      graph.getForwardLinks(noteB.id).map(link => graph.getNote(link.to)?.slug)
    ).toEqual(['page-a']);
    expect(
      graph.getBacklinks(noteA.id).map(link => graph.getNote(link.from)?.slug)
    ).toEqual(['page-b']);
    expect(
      graph.getBacklinks(noteC.id).map(link => graph.getNote(link.from)?.slug)
    ).toEqual([]);

    graph.setNote(
      createTestNote({
        uri: '/page-b.md',
        links: [{ slug: 'page-c' }],
      })
    );

    expect(
      graph.getForwardLinks(noteB.id).map(link => graph.getNote(link.to)?.slug)
    ).toEqual(['page-c']);
    expect(
      graph.getBacklinks(noteA.id).map(link => graph.getNote(link.from)?.slug)
    ).toEqual([]);
    expect(
      graph.getBacklinks(noteC.id).map(link => graph.getNote(link.from)?.slug)
    ).toEqual(['page-b']);

    // Tests #393: page-a should not lose its links when updated
    graph.setNote(createTestNote({ title: 'Test-C', uri: '/page-c.md' }));
    expect(
      graph.getBacklinks(noteC.id).map(link => graph.getNote(link.from)?.slug)
    ).toEqual(['page-b']);
  });

  it('Updates the graph properly when deleting a note', () => {
    // B should still link out to A after A is deleted. (#393)
    // C links out to A, like B, but should no longer link out once deleted.
    // Ensure B is only remaining note after A + C are deleted.
    const graph = new NoteGraph();

    const noteA = graph.setNote(createTestNote({ uri: '/page-a.md' }));
    const noteB = graph.setNote(
      createTestNote({
        uri: '/page-b.md',
        links: [{ slug: 'page-a' }],
      })
    );
    const noteC = graph.setNote(
      createTestNote({
        uri: '/page-c.md',
        links: [{ slug: 'page-a' }],
      })
    );

    graph.deleteNote(noteA.id);
    expect(
      graph.getForwardLinks(noteB.id).map(link => link?.link?.slug)
    ).toEqual(['page-a']);
    expect(graph.getNote(noteA.id)).toBeNull();

    graph.deleteNote(noteC.id);
    expect(
      graph.getForwardLinks(noteC.id).map(link => link?.link?.slug)
    ).toEqual([]);
    expect(graph.getNotes().map(note => note.slug)).toEqual(['page-b']);
  });
});

describe('Graph querying', () => {
  it('returns empty set if no note is found', () => {
    const graph = new NoteGraph();
    graph.setNote(createTestNote({ uri: '/page-a.md' }));
    expect(graph.getNotes({ slug: 'non-existing' })).toEqual([]);
    expect(graph.getNotes({ title: 'non-existing' })).toEqual([]);
  });

  it('finds the note by slug', () => {
    const graph = new NoteGraph();
    const note = graph.setNote(createTestNote({ uri: '/page-a.md' }));
    expect(graph.getNotes({ slug: note.slug }).length).toEqual(1);
  });

  it('finds a note by slug when there is more than one', () => {
    const graph = new NoteGraph();
    graph.setNote(createTestNote({ uri: '/dir1/page-a.md' }));
    graph.setNote(createTestNote({ uri: '/dir2/page-a.md' }));
    expect(graph.getNotes({ slug: 'page-a' }).length).toEqual(2);
  });

  it('finds a note by title', () => {
    const graph = new NoteGraph();
    graph.setNote(
      createTestNote({ uri: '/dir1/page-a.md', title: 'My Title' })
    );
    expect(graph.getNotes({ title: 'My Title' }).length).toEqual(1);
  });

  it('finds a note by title when there are several', () => {
    const graph = new NoteGraph();
    graph.setNote(
      createTestNote({ uri: '/dir1/page-a.md', title: 'My Title' })
    );
    graph.setNote(
      createTestNote({ uri: '/dir3/page-b.md', title: 'My Title' })
    );
    expect(graph.getNotes({ title: 'My Title' }).length).toEqual(2);
  });
});

describe('graph events', () => {
  it('fires "add" event when adding a new note', () => {
    const graph = new NoteGraph();
    const callback = jest.fn();
    const listener = graph.onDidAddNote(callback);
    graph.setNote(
      createTestNote({ uri: '/dir1/page-a.md', title: 'My Title' })
    );
    expect(callback).toHaveBeenCalledTimes(1);
    listener.dispose();
  });
  it('fires "updated" event when changing an existing note', () => {
    const graph = new NoteGraph();
    const callback = jest.fn();
    const listener = graph.onDidUpdateNote(callback);
    graph.setNote(
      createTestNote({ uri: '/dir1/page-a.md', title: 'My Title' })
    );
    graph.setNote(
      createTestNote({ uri: '/dir1/page-a.md', title: 'Another title' })
    );
    expect(callback).toHaveBeenCalledTimes(1);
    listener.dispose();
  });
  it('fires "delete" event when removing a note', () => {
    const graph = new NoteGraph();
    const callback = jest.fn();
    const listener = graph.onDidDeleteNote(callback);
    const note = graph.setNote(
      createTestNote({ uri: '/dir1/page-a.md', title: 'My Title' })
    );
    graph.deleteNote(note.id);
    expect(callback).toHaveBeenCalledTimes(1);
    listener.dispose();
  });
  it('does not fire "delete" event when removing a non-existing note', () => {
    const graph = new NoteGraph();
    const callback = jest.fn();
    const listener = graph.onDidDeleteNote(callback);
    const note = graph.setNote(
      createTestNote({ uri: '/dir1/page-a.md', title: 'My Title' })
    );
    graph.deleteNote('non-existing-note');
    expect(callback).toHaveBeenCalledTimes(0);
    listener.dispose();
  });
  it('happy lifecycle', () => {
    const graph = new NoteGraph();
    const addCallback = jest.fn();
    const updateCallback = jest.fn();
    const deleteCallback = jest.fn();
    const listeners = [
      graph.onDidAddNote(addCallback),
      graph.onDidUpdateNote(updateCallback),
      graph.onDidDeleteNote(deleteCallback),
    ];

    const note = graph.setNote(
      createTestNote({ uri: '/dir1/page-a.md', title: 'My Title' })
    );
    expect(addCallback).toHaveBeenCalledTimes(1);
    expect(updateCallback).toHaveBeenCalledTimes(0);
    expect(deleteCallback).toHaveBeenCalledTimes(0);

    graph.setNote(
      createTestNote({ uri: '/dir1/page-a.md', title: 'Another Title' })
    );
    expect(addCallback).toHaveBeenCalledTimes(1);
    expect(updateCallback).toHaveBeenCalledTimes(1);
    expect(deleteCallback).toHaveBeenCalledTimes(0);

    graph.setNote(
      createTestNote({ uri: '/dir1/page-a.md', title: 'Yet Another Title' })
    );
    expect(addCallback).toHaveBeenCalledTimes(1);
    expect(updateCallback).toHaveBeenCalledTimes(2);
    expect(deleteCallback).toHaveBeenCalledTimes(0);

    graph.deleteNote(note.id);
    expect(addCallback).toHaveBeenCalledTimes(1);
    expect(updateCallback).toHaveBeenCalledTimes(2);
    expect(deleteCallback).toHaveBeenCalledTimes(1);

    listeners.forEach(l => l.dispose());
  });
});

describe('graph middleware', () => {
  it('can intercept calls to the graph', async () => {
    const graph = createGraph([
      next => ({
        setNote: note => {
          note.properties = {
            injected: true,
          };
          return next.setNote(note);
        },
      }),
    ]);
    const note = createTestNote({ uri: '/dir1/page-a.md', title: 'My Title' });
    expect(note.properties['injected']).toBeUndefined();
    const res = graph.setNote(note);
    expect(res.properties['injected']).toBeTruthy();
  });
});
