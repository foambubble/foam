import { FoamWorkspace, getReferenceType } from '../src/model/workspace';
import { Logger } from '../src/utils/log';
import { createTestNote } from './core.test';
import { URI } from '../src/common/uri';

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

describe('Notes workspace', () => {
  it('Adds notes to workspace', () => {
    const ws = new FoamWorkspace();
    ws.setNote(createTestNote({ uri: '/page-a.md' }));
    ws.setNote(createTestNote({ uri: '/page-b.md' }));
    ws.setNote(createTestNote({ uri: '/page-c.md' }));

    expect(
      ws
        .getNotes()
        .map(n => n.uri.path)
        .sort()
    ).toEqual(['/page-a.md', '/page-b.md', '/page-c.md']);
  });

  it('Detects outbound wikilinks', () => {
    const noteA = createTestNote({
      uri: '/path/to/page-a.md',
      links: [
        { slug: 'page-b' },
        { slug: '../another/page-c.md' },
        { slug: '/absolute/path/page-d' },
        { slug: 'placeholder-test' },
      ],
    });
    const ws = new FoamWorkspace();
    ws.setNote(noteA)
      .setNote(createTestNote({ uri: '/somewhere/page-b.md' }))
      .setNote(createTestNote({ uri: '/path/another/page-c.md' }))
      .setNote(createTestNote({ uri: '/absolute/path/page-d.md' }))
      .resolveLinks();

    expect(
      ws
        .getLinks(noteA.uri)
        .map(link => link.path)
        .sort()
    ).toEqual([
      '/absolute/path/page-d.md',
      '/path/another/page-c.md',
      '/somewhere/page-b.md',
      'placeholder-test',
    ]);
  });

  it('Detects inbound wikilinks', () => {
    const noteA = createTestNote({
      uri: '/path/to/page-a.md',
      links: [{ slug: 'page-b' }],
    });
    const ws = new FoamWorkspace();
    ws.setNote(noteA)
      .setNote(
        createTestNote({
          uri: '/somewhere/page-b.md',
          links: [{ slug: 'page-a' }],
        })
      )
      .setNote(
        createTestNote({
          uri: '/path/another/page-c.md',
          links: [{ slug: '/path/to/page-a' }],
        })
      )
      .setNote(
        createTestNote({
          uri: '/absolute/path/page-d.md',
          links: [{ slug: '../to/page-a.md' }],
        })
      )
      .resolveLinks();

    expect(
      ws
        .getBacklinks(noteA.uri)
        .map(link => link.path)
        .sort()
    ).toEqual(['/path/another/page-c.md', '/somewhere/page-b.md']);
  });

  it('Detects markdown links', () => {
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
    ws.setNote(noteA)
      .setNote(noteB)
      .setNote(noteC)
      .resolveLinks();

    expect(
      ws
        .getLinks(noteA.uri)
        .map(link => link.path)
        .sort()
    ).toEqual(['/path/to/another/page-b.md', '/path/to/more/page-c.md']);

    expect(ws.getLinks(noteB.uri)).toEqual([noteA.uri]);
    expect(ws.getBacklinks(noteA.uri)).toEqual([noteB.uri]);
    expect(ws.getConnections(noteA.uri)).toEqual([
      { source: noteA.uri, target: noteB.uri },
      { source: noteA.uri, target: noteC.uri },
      { source: noteB.uri, target: noteA.uri },
    ]);
  });

  it('Fails if getting non-existing note', () => {
    const noteA = createTestNote({
      uri: '/path/to/page-a.md',
    });
    const ws = new FoamWorkspace();
    ws.setNote(noteA);

    const uri = URI.file('/path/to/another/page-b.md');
    expect(ws.noteExists(uri)).toBeFalsy();
    expect(ws.findNote(uri)).toBeNull();
    expect(() => ws.getNote(uri)).toThrow();
  });

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
    ws.setNote(noteA)
      .setNote(noteB)
      .setNote(noteC)
      .resolveLinks();

    expect(ws.getLinks(noteA.uri)).toEqual([noteB.uri]);
    expect(ws.getBacklinks(noteB.uri)).toEqual([noteA.uri]);
    expect(ws.getBacklinks(noteC.uri)).toEqual([noteB.uri]);

    // update the note
    const noteABis = createTestNote({
      uri: '/path/to/page-a.md',
      links: [{ slug: 'page-c' }],
    });
    ws.setNote(noteABis);
    expect(ws.getLinks(noteA.uri)).toEqual([noteB.uri]);
    expect(ws.getBacklinks(noteB.uri)).toEqual([noteA.uri]);
    expect(ws.getBacklinks(noteC.uri)).toEqual([noteB.uri]);

    // recompute the links
    ws.resolveLinks();
    expect(ws.getLinks(noteA.uri)).toEqual([noteC.uri]);
    expect(ws.getBacklinks(noteB.uri)).toEqual([]);
    expect(
      ws
        .getBacklinks(noteC.uri)
        .map(link => link.path)
        .sort()
    ).toEqual(['/path/to/another/page-b.md', '/path/to/page-a.md']);
  });
});
