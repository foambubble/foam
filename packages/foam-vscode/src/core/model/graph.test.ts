import { createTestNote, createTestWorkspace } from '../../test/test-utils';
import { FoamGraph } from './graph';
import { URI } from './uri';

describe('Graph', () => {
  it('should use wikilink slugs to connect nodes', () => {
    const workspace = createTestWorkspace();
    const noteA = createTestNote({
      uri: '/page-a.md',
      links: [
        { slug: 'page-b' },
        { slug: 'page-c' },
        { slug: 'Page D' },
        { slug: 'page e' },
      ],
    });
    const noteB = createTestNote({
      uri: '/page-b.md',
      links: [{ slug: 'page-a' }],
    });
    const noteC = createTestNote({ uri: '/page-c.md' });
    const noteD = createTestNote({ uri: '/Page D.md' });
    const noteE = createTestNote({ uri: '/page e.md' });

    workspace
      .set(noteA)
      .set(noteB)
      .set(noteC)
      .set(noteD)
      .set(noteE);
    const graph = FoamGraph.fromWorkspace(workspace);

    expect(graph.getBacklinks(noteB.uri).map(l => l.source)).toEqual([
      noteA.uri,
    ]);
    expect(graph.getLinks(noteA.uri).map(l => l.target)).toEqual([
      noteB.uri,
      noteC.uri,
      noteD.uri,
      noteE.uri,
    ]);
  });

  it('should include resources and placeholders', () => {
    const ws = createTestWorkspace();
    ws.set(
      createTestNote({
        uri: '/page-a.md',
        links: [{ slug: 'placeholder-link' }],
      })
    );
    ws.set(createTestNote({ uri: '/file.pdf' }));

    const graph = FoamGraph.fromWorkspace(ws);

    expect(
      graph
        .getAllNodes()
        .map(uri => uri.path)
        .sort()
    ).toEqual(['/file.pdf', '/page-a.md', 'placeholder-link']);
  });

  it('should support multiple connections between the same resources', () => {
    const noteA = createTestNote({
      uri: '/path/to/note-a.md',
    });
    const noteB = createTestNote({
      uri: '/note-b.md',
      links: [{ to: noteA.uri.path }, { to: noteA.uri.path }],
    });
    const ws = createTestWorkspace()
      .set(noteA)
      .set(noteB);
    const graph = FoamGraph.fromWorkspace(ws);
    expect(graph.getBacklinks(noteA.uri)).toEqual([
      {
        source: noteB.uri,
        target: noteA.uri,
        link: expect.objectContaining({ type: 'link' }),
      },
      {
        source: noteB.uri,
        target: noteA.uri,
        link: expect.objectContaining({ type: 'link' }),
      },
    ]);
  });

  it('should keep the connection when removing a single link amongst several between two resources', () => {
    const noteA = createTestNote({
      uri: '/path/to/note-a.md',
    });
    const noteB = createTestNote({
      uri: '/note-b.md',
      links: [{ to: noteA.uri.path }, { to: noteA.uri.path }],
    });
    const ws = createTestWorkspace()
      .set(noteA)
      .set(noteB);
    const graph = FoamGraph.fromWorkspace(ws, true);

    expect(graph.getBacklinks(noteA.uri).length).toEqual(2);

    const noteBBis = createTestNote({
      uri: '/note-b.md',
      links: [{ to: noteA.uri.path }],
    });
    ws.set(noteBBis);
    expect(graph.getBacklinks(noteA.uri).length).toEqual(1);

    ws.dispose();
    graph.dispose();
  });

  it('should create inbound connections for target note', () => {
    const noteA = createTestNote({
      uri: '/path/to/page-a.md',
      links: [{ slug: 'page-b' }],
    });
    const ws = createTestWorkspace()
      .set(noteA)
      .set(
        createTestNote({
          uri: '/somewhere/page-b.md',
          links: [{ slug: 'page-a' }],
        })
      )
      .set(
        createTestNote({
          uri: '/path/another/page-c.md',
          links: [{ slug: '/path/to/page-a' }],
        })
      )
      .set(
        createTestNote({
          uri: '/absolute/path/page-d.md',
          links: [{ slug: '../to/page-a.md' }],
        })
      );
    const graph = FoamGraph.fromWorkspace(ws);

    expect(
      graph
        .getBacklinks(noteA.uri)
        .map(link => link.source.path)
        .sort()
    ).toEqual(['/path/another/page-c.md', '/somewhere/page-b.md']);
  });

  it('should support attachments', () => {
    const noteA = createTestNote({
      uri: '/path/to/page-a.md',
      links: [
        // wikilink with extension
        { slug: 'attachment-a.pdf' },
        // wikilink without extension
        { slug: 'attachment-b' },
      ],
    });
    const attachmentA = createTestNote({
      uri: '/path/to/more/attachment-a.pdf',
    });
    const attachmentB = createTestNote({
      uri: '/path/to/more/attachment-b.pdf',
    });
    const ws = createTestWorkspace();
    ws.set(noteA)
      .set(attachmentA)
      .set(attachmentB);
    const graph = FoamGraph.fromWorkspace(ws);

    expect(graph.getBacklinks(attachmentA.uri).map(l => l.source)).toEqual([
      noteA.uri,
    ]);
    // Attachments require extension
    expect(graph.getBacklinks(attachmentB.uri).map(l => l.source)).toEqual([]);
  });

  it('should resolve conflicts alphabetically - part 1', () => {
    const noteA = createTestNote({
      uri: '/path/to/page-a.md',
      links: [{ slug: 'attachment-a.pdf' }],
    });
    const attachmentA = createTestNote({
      uri: '/path/to/more/attachment-a.pdf',
    });
    const attachmentABis = createTestNote({
      uri: '/path/to/attachment-a.pdf',
    });
    const ws = createTestWorkspace();
    ws.set(noteA)
      .set(attachmentA)
      .set(attachmentABis);
    const graph = FoamGraph.fromWorkspace(ws);

    expect(graph.getLinks(noteA.uri).map(l => l.target)).toEqual([
      attachmentABis.uri,
    ]);
  });

  it('should resolve conflicts alphabetically - part 2', () => {
    const noteA = createTestNote({
      uri: '/path/to/page-a.md',
      links: [{ slug: 'attachment-a.pdf' }],
    });
    const attachmentA = createTestNote({
      uri: '/path/to/more/attachment-a.pdf',
    });
    const attachmentABis = createTestNote({
      uri: '/path/to/attachment-a.pdf',
    });
    const ws = createTestWorkspace();
    ws.set(noteA)
      .set(attachmentABis)
      .set(attachmentA);
    const graph = FoamGraph.fromWorkspace(ws);

    expect(graph.getLinks(noteA.uri).map(l => l.target)).toEqual([
      attachmentABis.uri,
    ]);
  });
});

describe('Placeholders', () => {
  it('should treat direct links to non-existing files as placeholders', () => {
    const ws = createTestWorkspace();
    const noteA = createTestNote({
      uri: '/somewhere/from/page-a.md',
      links: [{ to: '../page-b.md' }, { to: '/path/to/page-c.md' }],
    });
    ws.set(noteA);
    const graph = FoamGraph.fromWorkspace(ws);

    expect(graph.getAllConnections()[0]).toEqual({
      source: noteA.uri,
      target: URI.placeholder('/somewhere/page-b.md'),
      link: expect.objectContaining({ type: 'link' }),
    });
    expect(graph.getAllConnections()[1]).toEqual({
      source: noteA.uri,
      target: URI.placeholder('/path/to/page-c.md'),
      link: expect.objectContaining({ type: 'link' }),
    });
  });

  it('should treat wikilinks without matching file as placeholders', () => {
    const ws = createTestWorkspace();
    const noteA = createTestNote({
      uri: '/somewhere/page-a.md',
      links: [{ slug: 'page-b' }],
    });
    ws.set(noteA);
    const graph = FoamGraph.fromWorkspace(ws);

    expect(graph.getAllConnections()[0]).toEqual({
      source: noteA.uri,
      target: URI.placeholder('page-b'),
      link: expect.objectContaining({ type: 'wikilink' }),
    });
  });

  it('should treat wikilink with definition to non-existing file as placeholders', () => {
    const ws = createTestWorkspace();
    const noteA = createTestNote({
      uri: '/somewhere/page-a.md',
      links: [{ slug: 'page-b' }, { slug: 'page-c' }],
    });
    noteA.definitions.push({
      label: 'page-b',
      url: './page-b.md',
    });
    noteA.definitions.push({
      label: 'page-c',
      url: '/path/to/page-c.md',
    });
    ws.set(noteA).set(
      createTestNote({ uri: '/different/location/for/note-b.md' })
    );
    const graph = FoamGraph.fromWorkspace(ws);

    expect(graph.getAllConnections()[0]).toEqual({
      source: noteA.uri,
      target: URI.placeholder('/somewhere/page-b.md'),
      link: expect.objectContaining({ type: 'wikilink' }),
    });
    expect(graph.getAllConnections()[1]).toEqual({
      source: noteA.uri,
      target: URI.placeholder('/path/to/page-c.md'),
      link: expect.objectContaining({ type: 'wikilink' }),
    });
  });

  it('should work with a placeholder named like a JS prototype property', () => {
    const ws = createTestWorkspace();
    const noteA = createTestNote({
      uri: '/page-a.md',
      links: [{ slug: 'constructor' }],
    });
    ws.set(noteA);
    const graph = FoamGraph.fromWorkspace(ws);

    expect(
      graph
        .getAllNodes()
        .map(uri => uri.path)
        .sort()
    ).toEqual(['/page-a.md', 'constructor']);
  });
});

describe('Regenerating graph after workspace changes', () => {
  it('should update links when modifying a resource', () => {
    const noteA = createTestNote({
      uri: '/path/to/page-a.md',
      links: [{ slug: 'page-b' }],
    });
    const noteB = createTestNote({
      uri: '/path/to/another/page-b.md',
      links: [{ slug: 'page-c' }],
    });
    const noteC = createTestNote({
      uri: '/path/to/more/page-c.md',
    });
    const ws = createTestWorkspace();
    ws.set(noteA)
      .set(noteB)
      .set(noteC);
    let graph = FoamGraph.fromWorkspace(ws);

    expect(graph.getLinks(noteA.uri).map(l => l.target)).toEqual([noteB.uri]);
    expect(graph.getBacklinks(noteB.uri).map(l => l.source)).toEqual([
      noteA.uri,
    ]);
    expect(graph.getBacklinks(noteC.uri).map(l => l.source)).toEqual([
      noteB.uri,
    ]);

    // update the note
    const noteABis = createTestNote({
      uri: '/path/to/page-a.md',
      links: [{ slug: 'page-c' }],
    });
    ws.set(noteABis);
    // change is not propagated immediately
    expect(graph.getLinks(noteA.uri).map(l => l.target)).toEqual([noteB.uri]);
    expect(graph.getBacklinks(noteB.uri).map(l => l.source)).toEqual([
      noteA.uri,
    ]);
    expect(graph.getBacklinks(noteC.uri).map(l => l.source)).toEqual([
      noteB.uri,
    ]);

    // recompute the links
    graph = FoamGraph.fromWorkspace(ws);
    expect(graph.getLinks(noteA.uri).map(l => l.target)).toEqual([noteC.uri]);
    expect(graph.getBacklinks(noteB.uri).map(l => l.source)).toEqual([]);
    expect(
      graph
        .getBacklinks(noteC.uri)
        .map(link => link.source.path)
        .sort()
    ).toEqual(['/path/to/another/page-b.md', '/path/to/page-a.md']);
    graph.dispose();
    ws.dispose();
  });

  it('should produce a placeholder for wikilinks pointing to a removed resource', () => {
    const noteA = createTestNote({
      uri: '/path/to/page-a.md',
      links: [{ slug: 'page-b' }],
    });
    const noteB = createTestNote({
      uri: '/path/to/another/page-b.md',
    });
    const ws = createTestWorkspace();
    ws.set(noteA).set(noteB);
    const graph = FoamGraph.fromWorkspace(ws);

    expect(graph.getLinks(noteA.uri).map(l => l.target)).toEqual([noteB.uri]);
    expect(graph.getBacklinks(noteB.uri).map(l => l.source)).toEqual([
      noteA.uri,
    ]);
    expect(ws.get(noteB.uri).type).toEqual('note');

    // remove note-b
    ws.delete(noteB.uri);
    const graph2 = FoamGraph.fromWorkspace(ws);

    expect(() => ws.get(noteB.uri)).toThrow();
    expect(graph2.contains(URI.placeholder('page-b'))).toBeTruthy();
  });

  it('should turn a placeholder into a connection when adding a resource matching a wikilink', () => {
    const noteA = createTestNote({
      uri: '/path/to/page-a.md',
      links: [{ slug: 'page-b' }],
    });
    const ws = createTestWorkspace();
    ws.set(noteA);
    const graph = FoamGraph.fromWorkspace(ws);

    expect(graph.getLinks(noteA.uri).map(l => l.target)).toEqual([
      URI.placeholder('page-b'),
    ]);
    expect(graph.contains(URI.placeholder('page-b'))).toBeTruthy();

    // add note-b
    const noteB = createTestNote({
      uri: '/path/to/another/page-b.md',
    });

    ws.set(noteB);
    FoamGraph.fromWorkspace(ws);

    expect(() => ws.get(URI.placeholder('page-b'))).toThrow();
    expect(ws.get(noteB.uri).type).toEqual('note');
  });

  it('should produce a placeholder for direct links pointing to a removed resource', () => {
    const noteA = createTestNote({
      uri: '/path/to/page-a.md',
      links: [{ to: '/path/to/another/page-b.md' }],
    });
    const noteB = createTestNote({
      uri: '/path/to/another/page-b.md',
    });
    const ws = createTestWorkspace();
    ws.set(noteA).set(noteB);
    const graph = FoamGraph.fromWorkspace(ws);

    expect(graph.getLinks(noteA.uri).map(l => l.target)).toEqual([noteB.uri]);
    expect(graph.getBacklinks(noteB.uri).map(l => l.source)).toEqual([
      noteA.uri,
    ]);
    expect(ws.get(noteB.uri).type).toEqual('note');

    // remove note-b
    ws.delete(noteB.uri);
    const graph2 = FoamGraph.fromWorkspace(ws);

    expect(() => ws.get(noteB.uri)).toThrow();
    expect(
      graph2.contains(URI.placeholder('/path/to/another/page-b.md'))
    ).toBeTruthy();
  });

  it('should turn a placeholder into a connection when adding a resource matching a direct link', () => {
    const noteA = createTestNote({
      uri: '/path/to/page-a.md',
      links: [{ to: '/path/to/another/page-b.md' }],
    });
    const ws = createTestWorkspace();
    ws.set(noteA);
    const graph = FoamGraph.fromWorkspace(ws);

    expect(graph.getLinks(noteA.uri).map(l => l.target)).toEqual([
      URI.placeholder('/path/to/another/page-b.md'),
    ]);
    expect(() =>
      ws.get(URI.placeholder('/path/to/another/page-b.md'))
    ).toThrow();

    // add note-b
    const noteB = createTestNote({
      uri: '/path/to/another/page-b.md',
    });

    ws.set(noteB);
    FoamGraph.fromWorkspace(ws);

    expect(() => ws.get(URI.placeholder('page-b'))).toThrow();
    expect(ws.get(noteB.uri).type).toEqual('note');
  });

  it('should remove the placeholder from graph when removing all links to it', () => {
    const noteA = createTestNote({
      uri: '/path/to/page-a.md',
      links: [{ to: '/path/to/another/page-b.md' }],
    });
    const ws = createTestWorkspace().set(noteA);
    const graph = FoamGraph.fromWorkspace(ws);
    expect(
      graph.contains(URI.placeholder('/path/to/another/page-b.md'))
    ).toBeTruthy();

    // update the note
    const noteABis = createTestNote({
      uri: '/path/to/page-a.md',
      links: [],
    });
    ws.set(noteABis);
    const graph2 = FoamGraph.fromWorkspace(ws);

    expect(
      graph2.contains(URI.placeholder('/path/to/another/page-b.md'))
    ).toBeFalsy();
  });
});

describe('Updating graph on workspace state', () => {
  it('should automatically update the links when modifying a resource', () => {
    const noteA = createTestNote({
      uri: '/path/to/page-a.md',
      links: [{ slug: 'page-b' }],
    });
    const noteB = createTestNote({
      uri: '/path/to/another/page-b.md',
      links: [{ slug: 'page-c' }],
    });
    const noteC = createTestNote({
      uri: '/path/to/more/page-c.md',
    });
    const ws = createTestWorkspace();
    ws.set(noteA)
      .set(noteB)
      .set(noteC);
    const graph = FoamGraph.fromWorkspace(ws, true);

    expect(graph.getLinks(noteA.uri).map(l => l.target)).toEqual([noteB.uri]);
    expect(graph.getBacklinks(noteB.uri).map(l => l.source)).toEqual([
      noteA.uri,
    ]);
    expect(graph.getBacklinks(noteC.uri).map(l => l.source)).toEqual([
      noteB.uri,
    ]);

    // update the note
    const noteABis = createTestNote({
      uri: '/path/to/page-a.md',
      links: [{ slug: 'page-c' }],
    });
    ws.set(noteABis);

    expect(graph.getLinks(noteA.uri).map(l => l.target)).toEqual([noteC.uri]);
    expect(graph.getBacklinks(noteB.uri).map(l => l.source)).toEqual([]);
    expect(
      graph
        .getBacklinks(noteC.uri)
        .map(link => link.source.path)
        .sort()
    ).toEqual(['/path/to/another/page-b.md', '/path/to/page-a.md']);
    ws.dispose();
    graph.dispose();
  });

  it('should produce a placeholder for wikilinks pointing to a removed resource', () => {
    const noteA = createTestNote({
      uri: '/path/to/page-a.md',
      links: [{ slug: 'page-b' }],
    });
    const noteB = createTestNote({
      uri: '/path/to/another/page-b.md',
    });
    const ws = createTestWorkspace();
    ws.set(noteA).set(noteB);
    const graph = FoamGraph.fromWorkspace(ws, true);

    expect(graph.getLinks(noteA.uri).map(l => l.target)).toEqual([noteB.uri]);
    expect(graph.getBacklinks(noteB.uri).map(l => l.source)).toEqual([
      noteA.uri,
    ]);
    expect(ws.get(noteB.uri).type).toEqual('note');

    // remove note-b
    ws.delete(noteB.uri);

    expect(() => ws.get(noteB.uri)).toThrow();
    ws.dispose();
    graph.dispose();
  });

  it('should turn a placeholder into a connection when adding a resource matching a wikilink', () => {
    const noteA = createTestNote({
      uri: '/path/to/page-a.md',
      links: [{ slug: 'page-b' }],
    });
    const ws = createTestWorkspace();
    ws.set(noteA);
    const graph = FoamGraph.fromWorkspace(ws, true);

    expect(graph.getLinks(noteA.uri).map(l => l.target)).toEqual([
      URI.placeholder('page-b'),
    ]);

    // add note-b
    const noteB = createTestNote({
      uri: '/path/to/another/page-b.md',
    });

    ws.set(noteB);

    expect(() => ws.get(URI.placeholder('page-b'))).toThrow();
    expect(ws.get(noteB.uri).type).toEqual('note');
    ws.dispose();
    graph.dispose();
  });

  it('should produce a placeholder for direct links pointing to a removed resource', () => {
    const noteA = createTestNote({
      uri: '/path/to/page-a.md',
      links: [{ to: '/path/to/another/page-b.md' }],
    });
    const noteB = createTestNote({
      uri: '/path/to/another/page-b.md',
    });
    const ws = createTestWorkspace();
    ws.set(noteA).set(noteB);
    const graph = FoamGraph.fromWorkspace(ws, true);

    expect(graph.getLinks(noteA.uri).map(l => l.target)).toEqual([noteB.uri]);
    expect(graph.getBacklinks(noteB.uri).map(l => l.source)).toEqual([
      noteA.uri,
    ]);
    expect(ws.get(noteB.uri).type).toEqual('note');

    // remove note-b
    ws.delete(noteB.uri);

    expect(() => ws.get(noteB.uri)).toThrow();
    expect(
      graph.contains(URI.placeholder('/path/to/another/page-b.md'))
    ).toBeTruthy();
    ws.dispose();
    graph.dispose();
  });

  it('should turn a placeholder into a connection when adding a resource matching a direct link', () => {
    const noteA = createTestNote({
      uri: '/path/to/page-a.md',
      links: [{ to: '/path/to/another/page-b.md' }],
    });
    const ws = createTestWorkspace();
    ws.set(noteA);
    const graph = FoamGraph.fromWorkspace(ws, true);

    expect(graph.getLinks(noteA.uri).map(l => l.target)).toEqual([
      URI.placeholder('/path/to/another/page-b.md'),
    ]);
    expect(
      graph.contains(URI.placeholder('/path/to/another/page-b.md'))
    ).toBeTruthy();

    // add note-b
    const noteB = createTestNote({
      uri: '/path/to/another/page-b.md',
    });

    ws.set(noteB);

    expect(() => ws.get(URI.placeholder('page-b'))).toThrow();
    expect(ws.get(noteB.uri).type).toEqual('note');
    ws.dispose();
    graph.dispose();
  });

  it('should remove the placeholder from graph when removing all links to it', () => {
    const noteA = createTestNote({
      uri: '/path/to/page-a.md',
      links: [{ to: '/path/to/another/page-b.md' }],
    });
    const ws = createTestWorkspace();
    ws.set(noteA);
    const graph = FoamGraph.fromWorkspace(ws, true);
    expect(
      graph.contains(URI.placeholder('/path/to/another/page-b.md'))
    ).toBeTruthy();

    // update the note
    const noteABis = createTestNote({
      uri: '/path/to/page-a.md',
      links: [],
    });
    ws.set(noteABis);
    expect(
      graph.contains(URI.placeholder('/path/to/another/page-b.md'))
    ).toBeFalsy();
    ws.dispose();
    graph.dispose();
  });
});
