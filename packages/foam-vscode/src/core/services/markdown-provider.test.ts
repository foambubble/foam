import { createMarkdownParser } from './markdown-parser';
import { createMarkdownReferences } from './markdown-provider';
import { Logger } from '../utils/log';
import { URI } from '../model/uri';
import {
  createTestNote,
  createTestWorkspace,
  getRandomURI,
} from '../../test/test-utils';

Logger.setLevel('error');

const parser = createMarkdownParser([]);
const createNoteFromMarkdown = (content: string, path?: string) =>
  parser.parse(path ? URI.file(path) : getRandomURI(), content);

describe('Link resolution', () => {
  describe('Wikilinks', () => {
    it('should resolve basename wikilinks with files in same directory', () => {
      const workspace = createTestWorkspace();
      const noteA = createNoteFromMarkdown('Link to [[page b]]', './page-a.md');
      const noteB = createNoteFromMarkdown('Content of page b', './page b.md');
      workspace.set(noteA).set(noteB);
      expect(workspace.resolveLink(noteA, noteA.links[0])).toEqual(noteB.uri);
    });

    it('should resolve basename wikilinks with files in other directory', () => {
      const workspace = createTestWorkspace();
      const noteA = createNoteFromMarkdown('Link to [[page b]]', './page-a.md');
      const noteB = createNoteFromMarkdown('Page b', './folder/page b.md');
      workspace.set(noteA).set(noteB);
      expect(workspace.resolveLink(noteA, noteA.links[0])).toEqual(noteB.uri);
    });

    it('should resolve wikilinks that represent an absolute path', () => {
      const workspace = createTestWorkspace();
      const noteA = createNoteFromMarkdown(
        'Link to [[/folder/page b]]',
        '/page-a.md'
      );
      const noteB = createNoteFromMarkdown('Page b', '/folder/page b.md');
      workspace.set(noteA).set(noteB);
      expect(workspace.resolveLink(noteA, noteA.links[0])).toEqual(noteB.uri);
    });

    it('should resolve wikilinks that represent a relative path', () => {
      const workspace = createTestWorkspace();
      const noteA = createNoteFromMarkdown(
        'Link to [[../two/page b]]',
        '/path/one/page-a.md'
      );
      const noteB = createNoteFromMarkdown('Page b', '/path/one/page b.md');
      const noteB2 = createNoteFromMarkdown('Page b 2', '/path/two/page b.md');
      workspace.set(noteA).set(noteB).set(noteB2);
      expect(workspace.resolveLink(noteA, noteA.links[0])).toEqual(noteB2.uri);
    });

    it('should resolve ambiguous wikilinks', () => {
      const workspace = createTestWorkspace();
      const noteA = createNoteFromMarkdown('Link to [[page b]]', '/page-a.md');
      const noteB = createNoteFromMarkdown('Page b', '/path/one/page b.md');
      const noteB2 = createNoteFromMarkdown('Page b2', '/path/two/page b.md');
      workspace.set(noteA).set(noteB).set(noteB2);
      expect(workspace.resolveLink(noteA, noteA.links[0])).toEqual(noteB.uri);
    });

    it('should resolve path wikilink even with other ambiguous notes', () => {
      const noteA = createTestNote({
        uri: '/path/to/page-a.md',
        links: [{ slug: './more/page-b' }, { slug: 'yet/page-b' }],
      });
      const noteB1 = createTestNote({ uri: '/path/to/another/page-b.md' });
      const noteB2 = createTestNote({ uri: '/path/to/more/page-b.md' });
      const noteB3 = createTestNote({ uri: '/path/to/yet/page-b.md' });

      const ws = createTestWorkspace();
      ws.set(noteA).set(noteB1).set(noteB2).set(noteB3);

      expect(ws.resolveLink(noteA, noteA.links[0])).toEqual(noteB2.uri);
      expect(ws.resolveLink(noteA, noteA.links[1])).toEqual(noteB3.uri);
    });

    it('should resolve Foam wikilinks', () => {
      const workspace = createTestWorkspace();
      const noteA = createNoteFromMarkdown(
        'Link to [[two/page b]] and [[one/page b]]',
        '/page-a.md'
      );
      const noteB = createNoteFromMarkdown('Page b', '/path/one/page b.md');
      const noteB2 = createNoteFromMarkdown('Page b2', '/path/two/page b.md');
      workspace.set(noteA).set(noteB).set(noteB2);
      expect(workspace.resolveLink(noteA, noteA.links[0])).toEqual(noteB2.uri);
      expect(workspace.resolveLink(noteA, noteA.links[1])).toEqual(noteB.uri);
    });

    it('should use wikilink definitions when available to resolve target', () => {
      const ws = createTestWorkspace();
      const noteA = createTestNote({
        uri: '/somewhere/from/page-a.md',
        links: [{ slug: 'page-b', definitionUrl: '../to/page-b.md' }],
      });
      const noteB = createTestNote({
        uri: '/somewhere/to/page-b.md',
      });
      ws.set(noteA).set(noteB);
      expect(ws.resolveLink(noteA, noteA.links[0])).toEqual(noteB.uri);
    });

    it('should support case insensitive wikilink resolution', () => {
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
      const noteB = createTestNote({ uri: '/somewhere/PAGE-B.md' });
      const noteC = createTestNote({ uri: '/path/another/page-c.md' });
      const noteD = createTestNote({ uri: '/path/another/page-d.md' });
      const ws = createTestWorkspace()
        .set(noteA)
        .set(noteB)
        .set(noteC)
        .set(noteD);

      expect(ws.resolveLink(noteA, noteA.links[0])).toEqual(noteB.uri);
      expect(ws.resolveLink(noteA, noteA.links[1])).toEqual(noteC.uri);
      expect(ws.resolveLink(noteA, noteA.links[2])).toEqual(noteD.uri);
    });

    it('should resolve wikilink with section identifier', () => {
      const noteA = createTestNote({
        uri: '/path/to/page-a.md',
        links: [
          // uppercased filename, lowercased slug
          { slug: 'page-b#section' },
        ],
      });
      const noteB = createTestNote({ uri: '/somewhere/PAGE-B.md' });
      const ws = createTestWorkspace().set(noteA).set(noteB);

      expect(ws.resolveLink(noteA, noteA.links[0])).toEqual(
        noteB.uri.with({ fragment: 'section' })
      );
    });

    it('should resolve section-only wikilinks', () => {
      const noteA = createTestNote({
        uri: '/path/to/page-a.md',
        links: [
          // uppercased filename, lowercased slug
          { slug: '#section' },
        ],
      });
      const ws = createTestWorkspace().set(noteA);

      expect(ws.resolveLink(noteA, noteA.links[0])).toEqual(
        noteA.uri.with({ fragment: 'section' })
      );
    });

    it('should resolve wikilinks with special characters', () => {
      const ws = createTestWorkspace();
      const noteA = createNoteFromMarkdown(
        `Link to [[page: a]] and [[page %b%]] and [[page? c]] and [[[page] d]] and
         [[page ^e^]] and [[page \`f\`]] and [[page {g}]] and [[page ~i]] and
         [[page /j]]`
      );
      const noteB = createNoteFromMarkdown(
        'Note containing :',
        '/dir1/page: a.md'
      );
      const noteC = createNoteFromMarkdown(
        'Note containing %',
        '/dir1/page %b%.md'
      );
      const noteD = createNoteFromMarkdown(
        'Note containing ?',
        '/dir1/page? c.md'
      );
      const noteE = createNoteFromMarkdown(
        'Note containing ]',
        '/dir1/[page] d.md'
      );
      const noteF = createNoteFromMarkdown(
        'Note containing ^',
        '/dir1/page ^e^.md'
      );
      const noteG = createNoteFromMarkdown(
        'Note containing `',
        '/dir1/page `f`.md'
      );
      const noteH = createNoteFromMarkdown(
        'Note containing { and }',
        '/dir1/page {g}.md'
      );
      const noteI = createNoteFromMarkdown(
        'Note containing ~',
        '/dir1/page ~i.md'
      );
      ws.set(noteA)
        .set(noteB)
        .set(noteC)
        .set(noteD)
        .set(noteE)
        .set(noteF)
        .set(noteG)
        .set(noteH)
        .set(noteI);

      expect(ws.resolveLink(noteA, noteA.links[0])).toEqual(noteB.uri);
      expect(ws.resolveLink(noteA, noteA.links[1])).toEqual(noteC.uri);
      expect(ws.resolveLink(noteA, noteA.links[2])).toEqual(noteD.uri);
      expect(ws.resolveLink(noteA, noteA.links[3])).toEqual(noteE.uri);
      expect(ws.resolveLink(noteA, noteA.links[4])).toEqual(noteF.uri);
      expect(ws.resolveLink(noteA, noteA.links[5])).toEqual(noteG.uri);
      expect(ws.resolveLink(noteA, noteA.links[6])).toEqual(noteH.uri);
      expect(ws.resolveLink(noteA, noteA.links[7])).toEqual(noteI.uri);
    });
  });

  describe('Markdown direct links', () => {
    it('should support absolute path 1', () => {
      const noteA = createTestNote({
        uri: '/path/to/page-a.md',
        links: [{ to: '/path/to/another/page-b.md' }],
      });
      const noteB = createTestNote({
        uri: '/path/to/another/page-b.md',
        links: [{ to: '../../to/page-a.md' }],
      });

      const ws = createTestWorkspace();
      ws.set(noteA).set(noteB);
      expect(ws.resolveLink(noteA, noteA.links[0])).toEqual(noteB.uri);
    });

    it('should support relative path 1', () => {
      const noteA = createTestNote({
        uri: '/path/to/page-a.md',
        links: [{ to: './another/page-b.md' }],
      });
      const noteB = createTestNote({
        uri: '/path/to/another/page-b.md',
        links: [{ to: '../../to/page-a.md' }],
      });

      const ws = createTestWorkspace();
      ws.set(noteA).set(noteB);
      expect(ws.resolveLink(noteA, noteA.links[0])).toEqual(noteB.uri);
    });

    it('should support relative path 2', () => {
      const noteA = createTestNote({
        uri: '/path/to/page-a.md',
        links: [{ to: 'more/page-b.md' }],
      });
      const noteB = createTestNote({
        uri: '/path/to/more/page-b.md',
      });
      const ws = createTestWorkspace();
      ws.set(noteA).set(noteB);
      expect(ws.resolveLink(noteA, noteA.links[0])).toEqual(noteB.uri);
    });

    it('should default to relative path', () => {
      const noteA = createTestNote({
        uri: '/path/to/page-a.md',
        links: [{ to: 'page .md' }],
      });
      const noteB = createTestNote({
        uri: '/path/to/page .md',
      });
      const ws = createTestWorkspace();
      ws.set(noteA).set(noteB);
      expect(ws.resolveLink(noteA, noteA.links[0])).toEqual(noteB.uri);
    });

    it('should support angle syntax #1039', () => {
      const noteA = createNoteFromMarkdown(
        'Content of note a',
        '/path/to/note a.md'
      );
      const noteB = createNoteFromMarkdown(
        'Link to [note](<./note a.md>)',
        '/path/to/note b.md'
      );
      const noteC = createNoteFromMarkdown(
        'Link to [note](./note%20a.md)',
        '/path/to/note c.md'
      );
      const noteD = createNoteFromMarkdown(
        'Link to [note](./note a.md)',
        '/path/to/note d.md'
      );

      const ws = createTestWorkspace();
      ws.set(noteA).set(noteB).set(noteC).set(noteD);

      expect(ws.resolveLink(noteB, noteB.links[0])).toEqual(noteA.uri);
      expect(ws.resolveLink(noteC, noteC.links[0])).toEqual(noteA.uri);
      // noteD has malformed URL with unencoded space, which gets treated as
      // shortcut reference [note] without definition, now correctly filtered out
      expect(noteD.links.length).toEqual(0);
    });

    describe('Workspace-relative paths (root-path relative)', () => {
      it('should resolve workspace-relative paths starting with /', () => {
        const noteA = createTestNote({
          uri: '/workspace/dir1/page-a.md',
          links: [{ to: '/dir2/page-b.md' }],
        });
        const noteB = createTestNote({
          uri: '/workspace/dir2/page-b.md',
        });

        const ws = createTestWorkspace([URI.file('/workspace')]);

        ws.set(noteA).set(noteB);
        expect(ws.resolveLink(noteA, noteA.links[0])).toEqual(noteB.uri);
      });

      it('should resolve workspace-relative paths with nested directories', () => {
        const noteA = createTestNote({
          uri: '/workspace/project/notes/page-a.md',
          links: [{ to: '/project/assets/image.png' }],
        });
        const assetB = createTestNote({
          uri: '/workspace/project/assets/image.png',
        });

        const ws = createTestWorkspace([URI.file('/workspace')]);

        ws.set(noteA).set(assetB);
        expect(ws.resolveLink(noteA, noteA.links[0])).toEqual(assetB.uri);
      });

      it('should handle workspace-relative paths with fragments', () => {
        const noteA = createTestNote({
          uri: '/workspace/dir1/page-a.md',
          links: [{ to: '/dir2/page-b.md#section' }],
        });
        const noteB = createTestNote({
          uri: '/workspace/dir2/page-b.md',
        });

        const ws = createTestWorkspace([URI.file('/workspace')]);

        ws.set(noteA).set(noteB);
        const resolved = ws.resolveLink(noteA, noteA.links[0]);
        expect(resolved).toEqual(noteB.uri.with({ fragment: 'section' }));
      });

      it('should fall back to placeholder for non-existent workspace-relative paths', () => {
        const noteA = createTestNote({
          uri: '/workspace/dir1/page-a.md',
          links: [{ to: '/dir2/non-existent.md' }],
        });

        const ws = createTestWorkspace([URI.file('/workspace')]);

        ws.set(noteA);
        const resolved = ws.resolveLink(noteA, noteA.links[0]);
        expect(resolved.isPlaceholder()).toBe(true);
        expect(resolved.path).toEqual('/workspace/dir2/non-existent.md');
      });

      it('should work with multiple workspace roots', () => {
        const noteA = createTestNote({
          uri: '/workspace1/dir1/page-a.md',
          links: [{ to: '/shared/page-b.md' }],
        });
        const noteB = createTestNote({
          uri: '/workspace2/shared/page-b.md',
        });

        const ws = createTestWorkspace([
          URI.file('/workspace1'),
          URI.file('/workspace2'),
        ]);

        ws.set(noteA).set(noteB);
        expect(ws.resolveLink(noteA, noteA.links[0])).toEqual(noteB.uri);
      });

      it('should preserve existing absolute path behavior when no workspace roots provided', () => {
        const noteA = createTestNote({
          uri: '/path/to/page-a.md',
          links: [{ to: '/path/to/another/page-b.md' }],
        });
        const noteB = createTestNote({
          uri: '/path/to/another/page-b.md',
        });

        const ws = createTestWorkspace();
        ws.set(noteA).set(noteB);
        // Default provider without workspace roots should work as before
        expect(ws.resolveLink(noteA, noteA.links[0])).toEqual(noteB.uri);
      });
    });
  });
});

describe('Generation of markdown references', () => {
  it('should generate links without file extension when includeExtension = false', () => {
    const workspace = createTestWorkspace();
    const noteA = createNoteFromMarkdown(
      'Link to [[page-b]] and [[page-c]]',
      '/dir1/page-a.md'
    );
    workspace
      .set(noteA)
      .set(createNoteFromMarkdown('Content of note B', '/dir1/page-b.md'))
      .set(createNoteFromMarkdown('Content of note C', '/dir1/page-c.md'));

    const references = createMarkdownReferences(workspace, noteA.uri, false);
    expect(references.map(r => r.url)).toEqual(['page-b', 'page-c']);
  });

  it('should generate links with file extension when includeExtension = true', () => {
    const workspace = createTestWorkspace();
    const noteA = createNoteFromMarkdown(
      'Link to [[page-b]] and [[page-c]]',
      '/dir1/page-a.md'
    );
    workspace
      .set(noteA)
      .set(createNoteFromMarkdown('Content of note B', '/dir1/page-b.md'))
      .set(createNoteFromMarkdown('Content of note C', '/dir1/page-c.md'));

    const references = createMarkdownReferences(workspace, noteA.uri, true);
    expect(references.map(r => r.url)).toEqual(['page-b.md', 'page-c.md']);
  });

  it('should always add extensions for attachments, even when includeExtension = false', () => {
    const workspace = createTestWorkspace();
    const noteA = createNoteFromMarkdown(
      'Link to [[page-b]] and [[image.png]]',
      '/dir1/page-a.md'
    );
    workspace
      .set(noteA)
      .set(createNoteFromMarkdown('Content of note B', '/dir1/page-b.md'))
      .set(createNoteFromMarkdown('', '/dir1/image.png'));

    const references = createMarkdownReferences(workspace, noteA.uri, false);
    expect(references.map(r => r.url)).toEqual(['page-b', 'image.png']);
  });

  it('should use relative paths', () => {
    const workspace = createTestWorkspace();
    const noteA = createNoteFromMarkdown(
      'Link to [[page-b]] and [[page-c]]',
      '/dir1/page-a.md'
    );
    workspace
      .set(noteA)
      .set(createNoteFromMarkdown('Content of note B', '/dir2/page-b.md'))
      .set(createNoteFromMarkdown('Content of note C', '/dir3/page-c.md'));

    const references = createMarkdownReferences(workspace, noteA.uri, true);
    expect(references.map(r => decodeURIComponent(r.url))).toEqual([
      '../dir2/page-b.md',
      '../dir3/page-c.md',
    ]);
  });

  it('should generate links for embedded notes that are formatted properly', () => {
    const workspace = createTestWorkspace();
    const noteA = createNoteFromMarkdown(
      'Link to ![[page-b]] and [[page-c]]',
      '/dir1/page-a.md'
    );
    workspace
      .set(noteA)
      .set(createNoteFromMarkdown('Content of note B', '/dir2/page-b.md'))
      .set(createNoteFromMarkdown('Content of note C', '/dir3/page-c.md'));

    const references = createMarkdownReferences(workspace, noteA.uri, true);
    expect(references.map(r => [decodeURIComponent(r.url), r.label])).toEqual([
      ['../dir2/page-b.md', 'page-b'],
      ['../dir3/page-c.md', 'page-c'],
    ]);
  });

  it('should not generate links for placeholders', () => {
    const workspace = createTestWorkspace();
    const noteA = createNoteFromMarkdown(
      'Link to ![[page-b]] and [[page-c]] and [[does-not-exist]] and ![[does-not-exist-either]]',
      '/dir1/page-a.md'
    );
    workspace
      .set(noteA)
      .set(createNoteFromMarkdown('Content of note B', '/dir2/page-b.md'))
      .set(createNoteFromMarkdown('Content of note C', '/dir3/page-c.md'));

    const references = createMarkdownReferences(workspace, noteA.uri, true);
    expect(references.map(r => decodeURIComponent(r.url))).toEqual([
      '../dir2/page-b.md',
      '../dir3/page-c.md',
    ]);
  });

  it('should encode special characters in links', () => {
    const workspace = createTestWorkspace();
    const noteA = createNoteFromMarkdown(
      `Link to [[page: a]] and [[page %b%]] and [[page? c]] and [[[page] d]] and
       [[page ^e^]] and [[page \`f\`]] and [[page {g}]] and [[page ~i]] and
       [[page /j]]`
    );
    workspace
      .set(noteA)
      .set(createNoteFromMarkdown('Note containing :', '/dir1/page: a.md'))
      .set(createNoteFromMarkdown('Note containing %', '/dir1/page %b%.md'))
      .set(createNoteFromMarkdown('Note containing ?', '/dir1/page? c.md'))
      .set(createNoteFromMarkdown('Note containing ]', '/dir1/[page] d.md'))
      .set(createNoteFromMarkdown('Note containing ^', '/dir1/page ^e^.md'))
      .set(createNoteFromMarkdown('Note containing `', '/dir1/page `f`.md'))
      .set(
        createNoteFromMarkdown('Note containing { and }', '/dir1/page {g}.md')
      )
      .set(createNoteFromMarkdown('Note containing ~', '/dir1/page ~i.md'));

    const references = createMarkdownReferences(workspace, noteA.uri, true);
    expect(references.map(r => decodeURIComponent(r.url))).toEqual([
      '../dir1/page: a.md',
      '../dir1/page %b%.md',
      '../dir1/page? c.md',
      '../dir1/[page] d.md',
      '../dir1/page ^e^.md',
      '../dir1/page `f`.md',
      '../dir1/page {g}.md',
      '../dir1/page ~i.md',
    ]);
  });
});
