import { FoamWorkspace, getReferenceType } from '../src/model/workspace';
import { Logger } from '../src/utils/log';
import { createTestNote, createAttachment } from './core.test';
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

  it('Detects outbound wikilinks', () => {
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
        .map(link => link.path)
        .sort()
    ).toEqual([
      '/absolute/path/page-d.md',
      '/absolute/path/page-e.md',
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
    ws.set(noteA)
      .set(noteB)
      .set(noteC)
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
    ws.set(noteA);

    const uri = URI.file('/path/to/another/page-b.md');
    expect(ws.exists(uri)).toBeFalsy();
    expect(ws.find(uri)).toBeNull();
    expect(() => ws.get(uri)).toThrow();
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
    ws.set(noteA)
      .set(noteB)
      .set(noteC)
      .resolveLinks();

    expect(ws.getLinks(noteA.uri)).toEqual([noteB.uri]);
    expect(ws.getBacklinks(noteB.uri)).toEqual([noteA.uri]);
    expect(ws.getBacklinks(noteC.uri)).toEqual([noteB.uri]);

    // update the note
    const noteABis = createTestNote({
      uri: '/path/to/page-a.md',
      links: [{ slug: 'page-c' }],
    });
    ws.set(noteABis);
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

    expect(ws.getBacklinks(attachmentA.uri)).toEqual([noteA.uri]);
    expect(ws.getBacklinks(attachmentB.uri)).toEqual([noteA.uri]);
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

    expect(ws.getLinks(noteA.uri)).toEqual([attachmentABis.uri]);
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

    expect(ws.getLinks(noteA.uri)).toEqual([attachmentABis.uri]);
  });
});
