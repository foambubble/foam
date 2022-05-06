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
      workspace
        .set(noteA)
        .set(noteB)
        .set(noteB2);
      expect(workspace.resolveLink(noteA, noteA.links[0])).toEqual(noteB2.uri);
    });

    it('should resolve ambiguous wikilinks', () => {
      const workspace = createTestWorkspace();
      const noteA = createNoteFromMarkdown('Link to [[page b]]', '/page-a.md');
      const noteB = createNoteFromMarkdown('Page b', '/path/one/page b.md');
      const noteB2 = createNoteFromMarkdown('Page b2', '/path/two/page b.md');
      workspace
        .set(noteA)
        .set(noteB)
        .set(noteB2);
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
      ws.set(noteA)
        .set(noteB1)
        .set(noteB2)
        .set(noteB3);

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
      workspace
        .set(noteA)
        .set(noteB)
        .set(noteB2);
      expect(workspace.resolveLink(noteA, noteA.links[0])).toEqual(noteB2.uri);
      expect(workspace.resolveLink(noteA, noteA.links[1])).toEqual(noteB.uri);
    });

    it('should use wikilink definitions when available to resolve target', () => {
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
      const ws = createTestWorkspace()
        .set(noteA)
        .set(noteB);

      expect(ws.resolveLink(noteA, noteA.links[0])).toEqual(
        noteB.uri.withFragment('section')
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
        noteA.uri.withFragment('section')
      );
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
    expect(references.map(r => r.url)).toEqual([
      '../dir2/page-b.md',
      '../dir3/page-c.md',
    ]);
  });
});
