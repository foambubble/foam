import { FoamWorkspace, getReferenceType } from '../src/model/workspace';
import { Logger } from '../src/utils/log';
import { createTestNote, createAttachment } from './core.test';
import { URI } from '../src/common/uri';
import { placeholderUri } from '../src/utils';

Logger.setLevel('error');

describe('Reference types', () => {
  it('Detects absolute references', () => {
    expect(getReferenceType('/hello')).toEqual('absolute-path');
    expect(getReferenceType('/hello/there')).toEqual('absolute-path');
  });
  it('Detects relative references', () => {
    expect(getReferenceType('../hello')).toEqual('relative-path');
    expect(getReferenceType('./hello')).toEqual('relative-path');
    expect(getReferenceType('./hello/there')).toEqual('relative-path');
  });
  it('Detects key references', () => {
    expect(getReferenceType('hello')).toEqual('key');
  });
  it('Detects URIs', () => {
    expect(getReferenceType(URI.file('/path/to/file.md'))).toEqual('uri');
  });
});

describe('Workspace resources', () => {
  it('Adds notes to workspace', () => {
    const ws = new FoamWorkspace();
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

  it('Listing resources includes notes, attachments and placeholders', () => {
    const ws = new FoamWorkspace();
    ws.set(createTestNote({ uri: '/page-a.md' }));
    ws.set(createAttachment({ uri: '/file.pdf' }));
    ws.set({ type: 'placeholder', uri: placeholderUri('place-holder') });

    expect(
      ws
        .list()
        .map(n => n.uri.path)
        .sort()
    ).toEqual(['/file.pdf', '/page-a.md', 'place-holder']);
  });

  it('Fails if getting non-existing note', () => {
    const noteA = createTestNote({
      uri: '/path/to/page-a.md',
    });
    const ws = new FoamWorkspace();
    ws.set(noteA);

    const uri = URI.file('/path/to/another/page-b.md');
    expect(ws.exists(uri)).toBeFalsy();
    expect(ws.find(uri)).toBeNull();
    expect(() => ws.get(uri)).toThrow();
  });
});

describe('Workspace links', () => {
  it('Supports multiple connections between the same resources', () => {
    const noteA = createTestNote({
      uri: '/path/to/note-a.md',
    });
    const noteB = createTestNote({
      uri: '/note-b.md',
      links: [{ to: noteA.uri.path }, { to: noteA.uri.path }],
    });
    const ws = new FoamWorkspace();
    ws.set(noteA)
      .set(noteB)
      .resolveLinks();
    expect(ws.getBacklinks(noteA.uri)).toEqual([
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
    const ws = new FoamWorkspace();
    ws.set(noteA)
      .set(noteB)
      .resolveLinks(true);

    expect(ws.getBacklinks(noteA.uri).length).toEqual(2);

    const noteBBis = createTestNote({
      uri: '/note-b.md',
      links: [{ to: noteA.uri.path }],
    });
    ws.set(noteBBis);
    expect(ws.getBacklinks(noteA.uri).length).toEqual(1);

    ws.dispose();
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
    const ws = new FoamWorkspace();
    ws.set(noteA)
      .set(createTestNote({ uri: '/somewhere/page-b.md' }))
      .set(createTestNote({ uri: '/path/another/page-c.md' }))
      .set(createTestNote({ uri: '/absolute/path/page-d.md' }))
      .set(createTestNote({ uri: '/absolute/path/page-e.md' }))
      .resolveLinks();

    expect(
      ws
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
    const ws = new FoamWorkspace();
    ws.set(noteA)
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
      )
      .resolveLinks();

    expect(
      ws
        .getBacklinks(noteA.uri)
        .map(link => link.source.path)
        .sort()
    ).toEqual(['/path/another/page-c.md', '/somewhere/page-b.md']);
  });

  it('Uses wikilink definitions when available to resolve target', () => {
    const ws = new FoamWorkspace();
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
    ws.set(noteA)
      .set(noteB)
      .resolveLinks();

    expect(ws.getAllConnections()[0]).toEqual({
      source: noteA.uri,
      target: noteB.uri,
      link: expect.objectContaining({ type: 'wikilink', slug: 'page-b' }),
    });
  });

  it('Resolves wikilink referencing more than one note', () => {
    const noteA = createTestNote({
      uri: '/path/to/page-a.md',
      links: [{ slug: 'page-b' }],
    });
    const noteB1 = createTestNote({ uri: '/path/to/another/page-b.md' });
    const noteB2 = createTestNote({ uri: '/path/to/more/page-b.md' });

    const ws = new FoamWorkspace();
    ws.set(noteA)
      .set(noteB1)
      .set(noteB2)
      .resolveLinks();

    expect(ws.getLinks(noteA.uri)).toEqual([
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

    const ws = new FoamWorkspace();
    ws.set(noteA)
      .set(noteB1)
      .set(noteB2)
      .set(noteB3)
      .resolveLinks();

    expect(ws.getLinks(noteA.uri).map(l => l.target)).toEqual([
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
    const attachmentA = createAttachment({
      uri: '/path/to/more/attachment-a.pdf',
    });
    const attachmentB = createAttachment({
      uri: '/path/to/more/attachment-b.pdf',
    });
    const ws = new FoamWorkspace();
    ws.set(noteA)
      .set(attachmentA)
      .set(attachmentB)
      .resolveLinks();

    expect(ws.getBacklinks(attachmentA.uri).map(l => l.source)).toEqual([
      noteA.uri,
    ]);
    expect(ws.getBacklinks(attachmentB.uri).map(l => l.source)).toEqual([
      noteA.uri,
    ]);
  });

  it('Resolves conflicts alphabetically - part 1', () => {
    const noteA = createTestNote({
      uri: '/path/to/page-a.md',
      links: [{ slug: 'attachment-a' }],
    });
    const attachmentA = createAttachment({
      uri: '/path/to/more/attachment-a.pdf',
    });
    const attachmentABis = createAttachment({
      uri: '/path/to/attachment-a.pdf',
    });
    const ws = new FoamWorkspace();
    ws.set(noteA)
      .set(attachmentA)
      .set(attachmentABis)
      .resolveLinks();

    expect(ws.getLinks(noteA.uri).map(l => l.target)).toEqual([
      attachmentABis.uri,
    ]);
  });

  it('Resolves conflicts alphabetically - part 2', () => {
    const noteA = createTestNote({
      uri: '/path/to/page-a.md',
      links: [{ slug: 'attachment-a' }],
    });
    const attachmentA = createAttachment({
      uri: '/path/to/more/attachment-a.pdf',
    });
    const attachmentABis = createAttachment({
      uri: '/path/to/attachment-a.pdf',
    });
    const ws = new FoamWorkspace();
    ws.set(noteA)
      .set(attachmentABis)
      .set(attachmentA)
      .resolveLinks();

    expect(ws.getLinks(noteA.uri).map(l => l.target)).toEqual([
      attachmentABis.uri,
    ]);
  });
});

describe('markdown direct links', () => {
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
    const ws = new FoamWorkspace();
    ws.set(noteA)
      .set(noteB)
      .set(noteC)
      .resolveLinks();

    expect(
      ws
        .getLinks(noteA.uri)
        .map(link => link.target.path)
        .sort()
    ).toEqual(['/path/to/another/page-b.md', '/path/to/more/page-c.md']);

    expect(ws.getLinks(noteB.uri).map(l => l.target)).toEqual([noteA.uri]);
    expect(ws.getBacklinks(noteA.uri).map(l => l.source)).toEqual([noteB.uri]);
    expect(ws.getConnections(noteA.uri)).toEqual([
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
    const ws = new FoamWorkspace();
    const noteA = createTestNote({
      uri: '/somewhere/from/page-a.md',
      links: [{ to: '../page-b.md' }, { to: '/path/to/page-c.md' }],
    });
    ws.set(noteA).resolveLinks();

    expect(ws.getAllConnections()[0]).toEqual({
      source: noteA.uri,
      target: placeholderUri('/somewhere/page-b.md'),
      link: expect.objectContaining({ type: 'link' }),
    });
    expect(ws.getAllConnections()[1]).toEqual({
      source: noteA.uri,
      target: placeholderUri('/path/to/page-c.md'),
      link: expect.objectContaining({ type: 'link' }),
    });
  });

  it('Treats wikilinks without matching file as placeholders', () => {
    const ws = new FoamWorkspace();
    const noteA = createTestNote({
      uri: '/somewhere/page-a.md',
      links: [{ slug: 'page-b' }],
    });
    ws.set(noteA).resolveLinks();

    expect(ws.getAllConnections()[0]).toEqual({
      source: noteA.uri,
      target: placeholderUri('page-b'),
      link: expect.objectContaining({ type: 'wikilink' }),
    });
  });
  it('Treats wikilink with definition to non-existing file as placeholders', () => {
    const ws = new FoamWorkspace();
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
    ws.set(noteA)
      .set(createTestNote({ uri: '/different/location/for/note-b.md' }))
      .resolveLinks();

    expect(ws.getAllConnections()[0]).toEqual({
      source: noteA.uri,
      target: placeholderUri('/somewhere/page-b.md'),
      link: expect.objectContaining({ type: 'wikilink' }),
    });
    expect(ws.getAllConnections()[1]).toEqual({
      source: noteA.uri,
      target: placeholderUri('/path/to/page-c.md'),
      link: expect.objectContaining({ type: 'wikilink' }),
    });
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
    const ws = new FoamWorkspace();
    ws.set(noteA)
      .set(noteB)
      .set(noteC)
      .resolveLinks();

    expect(ws.getLinks(noteA.uri).map(l => l.target)).toEqual([noteB.uri]);
    expect(ws.getBacklinks(noteB.uri).map(l => l.source)).toEqual([noteA.uri]);
    expect(ws.getBacklinks(noteC.uri).map(l => l.source)).toEqual([noteB.uri]);

    // update the note
    const noteABis = createTestNote({
      uri: '/path/to/page-a.md',
      links: [{ slug: 'page-c' }],
    });
    ws.set(noteABis);
    // change is not propagated immediately
    expect(ws.getLinks(noteA.uri).map(l => l.target)).toEqual([noteB.uri]);
    expect(ws.getBacklinks(noteB.uri).map(l => l.source)).toEqual([noteA.uri]);
    expect(ws.getBacklinks(noteC.uri).map(l => l.source)).toEqual([noteB.uri]);

    // recompute the links
    ws.resolveLinks();
    expect(ws.getLinks(noteA.uri).map(l => l.target)).toEqual([noteC.uri]);
    expect(ws.getBacklinks(noteB.uri).map(l => l.source)).toEqual([]);
    expect(
      ws
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
    const ws = new FoamWorkspace();
    ws.set(noteA)
      .set(noteB)
      .resolveLinks();

    expect(ws.getLinks(noteA.uri).map(l => l.target)).toEqual([noteB.uri]);
    expect(ws.getBacklinks(noteB.uri).map(l => l.source)).toEqual([noteA.uri]);
    expect(ws.get(noteB.uri).type).toEqual('note');

    // remove note-b
    ws.delete(noteB.uri);
    ws.resolveLinks();

    expect(() => ws.get(noteB.uri)).toThrow();
    expect(ws.get(placeholderUri('page-b')).type).toEqual('placeholder');
  });

  it('Adding note should replace placeholder for wikilinks', () => {
    const noteA = createTestNote({
      uri: '/path/to/page-a.md',
      links: [{ slug: 'page-b' }],
    });
    const ws = new FoamWorkspace();
    ws.set(noteA).resolveLinks();

    expect(ws.getLinks(noteA.uri).map(l => l.target)).toEqual([
      placeholderUri('page-b'),
    ]);
    expect(ws.get(placeholderUri('page-b')).type).toEqual('placeholder');

    // add note-b
    const noteB = createTestNote({
      uri: '/path/to/another/page-b.md',
    });

    ws.set(noteB);
    ws.resolveLinks();

    expect(() => ws.get(placeholderUri('page-b'))).toThrow();
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
    const ws = new FoamWorkspace();
    ws.set(noteA)
      .set(noteB)
      .resolveLinks();

    expect(ws.getLinks(noteA.uri).map(l => l.target)).toEqual([noteB.uri]);
    expect(ws.getBacklinks(noteB.uri).map(l => l.source)).toEqual([noteA.uri]);
    expect(ws.get(noteB.uri).type).toEqual('note');

    // remove note-b
    ws.delete(noteB.uri);
    ws.resolveLinks();

    expect(() => ws.get(noteB.uri)).toThrow();
    expect(ws.get(placeholderUri('/path/to/another/page-b.md')).type).toEqual(
      'placeholder'
    );
  });

  it('Adding note should replace placeholder for direct links', () => {
    const noteA = createTestNote({
      uri: '/path/to/page-a.md',
      links: [{ to: '/path/to/another/page-b.md' }],
    });
    const ws = new FoamWorkspace();
    ws.set(noteA).resolveLinks();

    expect(ws.getLinks(noteA.uri).map(l => l.target)).toEqual([
      placeholderUri('/path/to/another/page-b.md'),
    ]);
    expect(ws.get(placeholderUri('/path/to/another/page-b.md')).type).toEqual(
      'placeholder'
    );

    // add note-b
    const noteB = createTestNote({
      uri: '/path/to/another/page-b.md',
    });

    ws.set(noteB);
    ws.resolveLinks();

    expect(() => ws.get(placeholderUri('page-b'))).toThrow();
    expect(ws.get(noteB.uri).type).toEqual('note');
  });

  it('removing link to placeholder should remove placeholder', () => {
    const noteA = createTestNote({
      uri: '/path/to/page-a.md',
      links: [{ to: '/path/to/another/page-b.md' }],
    });
    const ws = new FoamWorkspace();
    ws.set(noteA).resolveLinks();
    expect(ws.get(placeholderUri('/path/to/another/page-b.md')).type).toEqual(
      'placeholder'
    );

    // update the note
    const noteABis = createTestNote({
      uri: '/path/to/page-a.md',
      links: [],
    });
    ws.set(noteABis).resolveLinks();

    expect(() =>
      ws.get(placeholderUri('/path/to/another/page-b.md'))
    ).toThrow();
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
    const ws = new FoamWorkspace();
    ws.set(noteA)
      .set(noteB)
      .set(noteC)
      .resolveLinks(true);

    expect(ws.getLinks(noteA.uri).map(l => l.target)).toEqual([noteB.uri]);
    expect(ws.getBacklinks(noteB.uri).map(l => l.source)).toEqual([noteA.uri]);
    expect(ws.getBacklinks(noteC.uri).map(l => l.source)).toEqual([noteB.uri]);

    // update the note
    const noteABis = createTestNote({
      uri: '/path/to/page-a.md',
      links: [{ slug: 'page-c' }],
    });
    ws.set(noteABis);

    expect(ws.getLinks(noteA.uri).map(l => l.target)).toEqual([noteC.uri]);
    expect(ws.getBacklinks(noteB.uri).map(l => l.source)).toEqual([]);
    expect(
      ws
        .getBacklinks(noteC.uri)
        .map(link => link.source.path)
        .sort()
    ).toEqual(['/path/to/another/page-b.md', '/path/to/page-a.md']);
    ws.dispose();
  });

  it('Removing target note should produce placeholder for wikilinks', () => {
    const noteA = createTestNote({
      uri: '/path/to/page-a.md',
      links: [{ slug: 'page-b' }],
    });
    const noteB = createTestNote({
      uri: '/path/to/another/page-b.md',
    });
    const ws = new FoamWorkspace();
    ws.set(noteA)
      .set(noteB)
      .resolveLinks(true);

    expect(ws.getLinks(noteA.uri).map(l => l.target)).toEqual([noteB.uri]);
    expect(ws.getBacklinks(noteB.uri).map(l => l.source)).toEqual([noteA.uri]);
    expect(ws.get(noteB.uri).type).toEqual('note');

    // remove note-b
    ws.delete(noteB.uri);

    expect(() => ws.get(noteB.uri)).toThrow();
    expect(ws.get(placeholderUri('page-b')).type).toEqual('placeholder');
    ws.dispose();
  });

  it('Adding note should replace placeholder for wikilinks', () => {
    const noteA = createTestNote({
      uri: '/path/to/page-a.md',
      links: [{ slug: 'page-b' }],
    });
    const ws = new FoamWorkspace();
    ws.set(noteA).resolveLinks(true);

    expect(ws.getLinks(noteA.uri).map(l => l.target)).toEqual([
      placeholderUri('page-b'),
    ]);
    expect(ws.get(placeholderUri('page-b')).type).toEqual('placeholder');

    // add note-b
    const noteB = createTestNote({
      uri: '/path/to/another/page-b.md',
    });

    ws.set(noteB);

    expect(() => ws.get(placeholderUri('page-b'))).toThrow();
    expect(ws.get(noteB.uri).type).toEqual('note');
    ws.dispose();
  });

  it('Removing target note should produce placeholder for direct links', () => {
    const noteA = createTestNote({
      uri: '/path/to/page-a.md',
      links: [{ to: '/path/to/another/page-b.md' }],
    });
    const noteB = createTestNote({
      uri: '/path/to/another/page-b.md',
    });
    const ws = new FoamWorkspace();
    ws.set(noteA)
      .set(noteB)
      .resolveLinks(true);

    expect(ws.getLinks(noteA.uri).map(l => l.target)).toEqual([noteB.uri]);
    expect(ws.getBacklinks(noteB.uri).map(l => l.source)).toEqual([noteA.uri]);
    expect(ws.get(noteB.uri).type).toEqual('note');

    // remove note-b
    ws.delete(noteB.uri);

    expect(() => ws.get(noteB.uri)).toThrow();
    expect(ws.get(placeholderUri('/path/to/another/page-b.md')).type).toEqual(
      'placeholder'
    );
    ws.dispose();
  });

  it('Adding note should replace placeholder for direct links', () => {
    const noteA = createTestNote({
      uri: '/path/to/page-a.md',
      links: [{ to: '/path/to/another/page-b.md' }],
    });
    const ws = new FoamWorkspace();
    ws.set(noteA).resolveLinks(true);

    expect(ws.getLinks(noteA.uri).map(l => l.target)).toEqual([
      placeholderUri('/path/to/another/page-b.md'),
    ]);
    expect(ws.get(placeholderUri('/path/to/another/page-b.md')).type).toEqual(
      'placeholder'
    );

    // add note-b
    const noteB = createTestNote({
      uri: '/path/to/another/page-b.md',
    });

    ws.set(noteB);

    expect(() => ws.get(placeholderUri('page-b'))).toThrow();
    expect(ws.get(noteB.uri).type).toEqual('note');
    ws.dispose();
  });

  it('removing link to placeholder should remove placeholder', () => {
    const noteA = createTestNote({
      uri: '/path/to/page-a.md',
      links: [{ to: '/path/to/another/page-b.md' }],
    });
    const ws = new FoamWorkspace();
    ws.set(noteA).resolveLinks(true);
    expect(ws.get(placeholderUri('/path/to/another/page-b.md')).type).toEqual(
      'placeholder'
    );

    // update the note
    const noteABis = createTestNote({
      uri: '/path/to/page-a.md',
      links: [],
    });
    ws.set(noteABis);
    expect(() =>
      ws.get(placeholderUri('/path/to/another/page-b.md'))
    ).toThrow();
    ws.dispose();
  });
});
