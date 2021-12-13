import { FoamWorkspace } from './workspace';
import { FoamGraph } from './graph';
import { Logger } from '../utils/log';
import { URI } from './uri';
import { createTestNote, createTestWorkspace } from '../../test/test-utils';

Logger.setLevel('error');

describe('Workspace resources', () => {
  it('Adds notes to workspace', () => {
    const ws = createTestWorkspace();
    ws.set(createTestNote({ uri: '/page-a.md' }));
    ws.set(createTestNote({ uri: '/page-b.md' }));
    ws.set(createTestNote({ uri: '/page-c.md' }));

    expect(
      ws
        .list()
        .map(n => n.uri.path)
        .sort()
    ).toEqual(['/page-a.md', '/page-b.md', '/page-c.md']);
  });

  it('Listing resources includes all notes', () => {
    const ws = createTestWorkspace();
    ws.set(createTestNote({ uri: '/page-a.md' }));
    ws.set(createTestNote({ uri: '/file.pdf' }));

    expect(
      ws
        .list()
        .map(n => n.uri.path)
        .sort()
    ).toEqual(['/file.pdf', '/page-a.md']);
  });

  it('Fails if getting non-existing note', () => {
    const noteA = createTestNote({
      uri: '/path/to/page-a.md',
    });
    const ws = createTestWorkspace();
    ws.set(noteA);

    const uri = URI.file('/path/to/another/page-b.md');
    expect(ws.exists(uri)).toBeFalsy();
    expect(ws.find(uri)).toBeNull();
    expect(() => ws.get(uri)).toThrow();
  });

  it('Should work with a resource named like a JS prototype property', () => {
    const ws = createTestWorkspace();
    const noteA = createTestNote({ uri: '/somewhere/constructor.md' });
    ws.set(noteA);
    expect(ws.list()).toEqual([noteA]);
  });

  it('#851 - listing by ID should not return files with same suffix', () => {
    const ws = createTestWorkspace()
      .set(createTestNote({ uri: 'test-file.md' }))
      .set(createTestNote({ uri: 'file.md' }));
    expect(ws.listByIdentifier('file').length).toEqual(1);
  });

  it('Support dendron-style names', () => {
    const ws = createTestWorkspace()
      .set(createTestNote({ uri: 'note.pdf' }))
      .set(createTestNote({ uri: 'note.md' }))
      .set(createTestNote({ uri: 'note.yo.md' }))
      .set(createTestNote({ uri: 'note2.md' }));
    for (const [reference, path] of [
      ['note', '/note.md'],
      ['note.md', '/note.md'],
      ['note.yo', '/note.yo.md'],
      ['note.yo.md', '/note.yo.md'],
      ['note.pdf', '/note.pdf'],
      ['note2', '/note2.md'],
    ]) {
      expect(ws.listByIdentifier(reference)[0].uri.path).toEqual(path);
      expect(ws.find(reference).uri.path).toEqual(path);
    }
  });

  it('Should include fragment when finding resource URI', () => {
    const ws = createTestWorkspace()
      .set(createTestNote({ uri: 'test-file.md' }))
      .set(createTestNote({ uri: 'file.md' }));

    const res = ws.find('test-file#my-section');
    expect(res.uri.fragment).toEqual('my-section');
  });
});

describe('Graph', () => {
  it('contains notes and placeholders', () => {
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

  it('Supports multiple connections between the same resources', () => {
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
  it('Supports removing a single link amongst several between two resources', () => {
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
});

describe('Identifier computation', () => {
  it('should compute the minimum identifier to resolve a name clash', () => {
    const first = createTestNote({
      uri: '/path/to/page-a.md',
    });
    const second = createTestNote({
      uri: '/another/way/for/page-a.md',
    });
    const third = createTestNote({
      uri: '/another/path/for/page-a.md',
    });
    const ws = new FoamWorkspace()
      .set(first)
      .set(second)
      .set(third);

    expect(ws.getIdentifier(first.uri)).toEqual('to/page-a');
    expect(ws.getIdentifier(second.uri)).toEqual('way/for/page-a');
    expect(ws.getIdentifier(third.uri)).toEqual('path/for/page-a');
  });

  it('should support sections in identifier computation', () => {
    const first = createTestNote({
      uri: '/path/to/page-a.md',
    });
    const second = createTestNote({
      uri: '/another/way/for/page-a.md',
    });
    const third = createTestNote({
      uri: '/another/path/for/page-a.md',
    });
    const ws = new FoamWorkspace()
      .set(first)
      .set(second)
      .set(third);

    expect(ws.getIdentifier(first.uri.withFragment('section name'))).toEqual(
      'to/page-a#section name'
    );
  });

  const needle = '/project/car/todo';

  test.each([
    [['/project/home/todo', '/other/todo', '/something/else'], 'car/todo'],
    [['/family/car/todo', '/other/todo'], 'project/car/todo'],
    [[], 'todo'],
  ])('Find shortest identifier', (haystack, id) => {
    expect(FoamWorkspace.getShortestIdentifier(needle, haystack)).toEqual(id);
  });

  it('should ignore same string in haystack', () => {
    const haystack = [
      needle,
      '/project/home/todo',
      '/other/todo',
      '/something/else',
    ];
    const identifier = FoamWorkspace.getShortestIdentifier(needle, haystack);
    expect(identifier).toEqual('car/todo');
  });

  it('should return best guess when no solution is possible', () => {
    /**
     * In this case there is no way to uniquely identify the element,
     * our fallback is to just return the "least wrong" result, basically
     * a full identifier
     * This is an edge case that should never happen in a real repo
     */
    const haystack = [
      '/parent/' + needle,
      '/project/home/todo',
      '/other/todo',
      '/something/else',
    ];
    const identifier = FoamWorkspace.getShortestIdentifier(needle, haystack);
    expect(identifier).toEqual('project/car/todo');
  });
});

describe('Wikilinks', () => {
  it('Can be defined with basename, relative path, absolute path, extension', () => {
    const noteA = createTestNote({
      uri: '/path/to/page-a.md',
      links: [
        // wikilink
        { slug: 'page-b' },
        // relative path wikilink
        { slug: '../another/page-c.md' },
        // absolute path wikilink
        { slug: '/absolute/path/page-d' },
        // wikilink with extension
        { slug: 'page-e.md' },
        // wikilink to placeholder
        { slug: 'placeholder-test' },
      ],
    });
    const ws = createTestWorkspace()
      .set(noteA)
      .set(createTestNote({ uri: '/somewhere/page-b.md' }))
      .set(createTestNote({ uri: '/path/another/page-c.md' }))
      .set(createTestNote({ uri: '/absolute/path/page-d.md' }))
      .set(createTestNote({ uri: '/absolute/path/page-e.md' }));
    const graph = FoamGraph.fromWorkspace(ws);

    expect(
      graph
        .getLinks(noteA.uri)
        .map(link => link.target.path)
        .sort()
    ).toEqual([
      '/absolute/path/page-d.md',
      '/absolute/path/page-e.md',
      '/path/another/page-c.md',
      '/somewhere/page-b.md',
      'placeholder-test',
    ]);
  });

  it('Creates inbound connections for target note', () => {
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

  it('Uses wikilink definitions when available to resolve target', () => {
    const ws = createTestWorkspace();
    const noteA = createTestNote({
      uri: '/somewhere/from/page-a.md',
      links: [{ slug: 'page-b' }],
    });
    noteA.definitions.push({
      label: 'page-b',
      url: '../to/page-b.md',
    });
    const noteB = createTestNote({
      uri: '/somewhere/to/page-b.md',
    });
    ws.set(noteA).set(noteB);
    const graph = FoamGraph.fromWorkspace(ws);

    expect(graph.getAllConnections()[0]).toEqual({
      source: noteA.uri,
      target: noteB.uri,
      link: expect.objectContaining({ type: 'wikilink', label: 'page-b' }),
    });
  });

  it('Resolves wikilink referencing more than one note', () => {
    const noteA = createTestNote({
      uri: '/path/to/page-a.md',
      links: [{ slug: 'page-b' }],
    });
    const noteB1 = createTestNote({ uri: '/path/to/another/page-b.md' });
    const noteB2 = createTestNote({ uri: '/path/to/more/page-b.md' });

    const ws = createTestWorkspace();
    ws.set(noteA)
      .set(noteB1)
      .set(noteB2);
    const graph = FoamGraph.fromWorkspace(ws);

    expect(graph.getLinks(noteA.uri)).toEqual([
      {
        source: noteA.uri,
        target: noteB1.uri,
        link: expect.objectContaining({ type: 'wikilink' }),
      },
    ]);
  });

  it('Resolves path wikilink in case of name conflict', () => {
    const noteA = createTestNote({
      uri: '/path/to/page-a.md',
      links: [{ slug: './more/page-b' }, { slug: 'yet/page-b' }],
    });
    const noteB1 = createTestNote({ uri: '/path/to/another/page-b.md' });
    const noteB2 = createTestNote({ uri: '/path/to/more/page-b.md' });
    const noteB3 = createTestNote({ uri: '/path/to/yet/page-b.md' });

    const ws = createTestWorkspace();
    ws.set(noteA)
      .set(noteB1)
      .set(noteB2)
      .set(noteB3);
    const graph = FoamGraph.fromWorkspace(ws);

    expect(graph.getLinks(noteA.uri).map(l => l.target)).toEqual([
      noteB2.uri,
      noteB3.uri,
    ]);
  });

  it('Supports attachments', () => {
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

  it('Resolves conflicts alphabetically - part 1', () => {
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

  it('Resolves conflicts alphabetically - part 2', () => {
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

  it('Handles capitalization of files and wikilinks correctly', () => {
    const noteA = createTestNote({
      uri: '/path/to/page-a.md',
      links: [
        // uppercased filename, lowercased slug
        { slug: 'page-b' },
        // lowercased filename, camelcased wikilink
        { slug: 'Page-C' },
        // lowercased filename, lowercased wikilink
        { slug: 'page-d' },
      ],
    });
    const ws = createTestWorkspace()
      .set(noteA)
      .set(createTestNote({ uri: '/somewhere/PAGE-B.md' }))
      .set(createTestNote({ uri: '/path/another/page-c.md' }))
      .set(createTestNote({ uri: '/path/another/page-d.md' }));
    const graph = FoamGraph.fromWorkspace(ws);

    expect(
      graph
        .getLinks(noteA.uri)
        .map(link => link.target.path)
        .sort()
    ).toEqual([
      '/path/another/page-c.md',
      '/path/another/page-d.md',
      '/somewhere/PAGE-B.md',
    ]);
  });
});

describe('Markdown direct links', () => {
  it('Support absolute and relative path', () => {
    const noteA = createTestNote({
      uri: '/path/to/page-a.md',
      links: [{ to: './another/page-b.md' }, { to: 'more/page-c.md' }],
    });
    const noteB = createTestNote({
      uri: '/path/to/another/page-b.md',
      links: [{ to: '../../to/page-a.md' }],
    });
    const noteC = createTestNote({
      uri: '/path/to/more/page-c.md',
    });
    const ws = createTestWorkspace();
    ws.set(noteA)
      .set(noteB)
      .set(noteC);
    const graph = FoamGraph.fromWorkspace(ws);

    expect(
      graph
        .getLinks(noteA.uri)
        .map(link => link.target.path)
        .sort()
    ).toEqual(['/path/to/another/page-b.md', '/path/to/more/page-c.md']);

    expect(graph.getLinks(noteB.uri).map(l => l.target)).toEqual([noteA.uri]);
    expect(graph.getBacklinks(noteA.uri).map(l => l.source)).toEqual([
      noteB.uri,
    ]);
    expect(graph.getConnections(noteA.uri)).toEqual([
      {
        source: noteA.uri,
        target: noteB.uri,
        link: expect.objectContaining({ type: 'link' }),
      },
      {
        source: noteA.uri,
        target: noteC.uri,
        link: expect.objectContaining({ type: 'link' }),
      },
      {
        source: noteB.uri,
        target: noteA.uri,
        link: expect.objectContaining({ type: 'link' }),
      },
    ]);
  });
});

describe('Placeholders', () => {
  it('Treats direct links to non-existing files as placeholders', () => {
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

  it('Treats wikilinks without matching file as placeholders', () => {
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
  it('Treats wikilink with definition to non-existing file as placeholders', () => {
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

  it('Should work with a placeholder named like a JS prototype property', () => {
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

describe('Updating workspace happy path', () => {
  it('Update links when modifying note', () => {
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
  });

  it('Removing target note should produce placeholder for wikilinks', () => {
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

  it('Adding note should replace placeholder for wikilinks', () => {
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

  it('Removing target note should produce placeholder for direct links', () => {
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

  it('Adding note should replace placeholder for direct links', () => {
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

  it('removing link to placeholder should remove placeholder', () => {
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

describe('Monitoring of workspace state', () => {
  it('Update links when modifying note', () => {
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

  it('Removing target note should produce placeholder for wikilinks', () => {
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

  it('Adding note should replace placeholder for wikilinks', () => {
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

  it('Removing target note should produce placeholder for direct links', () => {
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

  it('Adding note should replace placeholder for direct links', () => {
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

  it('removing link to placeholder should remove placeholder', () => {
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
