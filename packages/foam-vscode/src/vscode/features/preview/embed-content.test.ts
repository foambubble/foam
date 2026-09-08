import MarkdownIt from 'markdown-it';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { FoamGraph, URI, createMarkdownParser } from '@foam/core';
import { createTestWorkspace } from '../../../test/test-utils';
import { createFoamMarkdownIt } from './foam-markdown-it';

function withNote(
  source: string,
  check: (render: (input: string) => string) => void
) {
  const dir = mkdtempSync(path.join(tmpdir(), 'foam-embed-content-'));
  const uri = URI.file(path.join(dir, 'Child.md'));
  writeFileSync(uri.toFsPath(), source);
  const parser = createMarkdownParser();
  const note = parser.parse(uri, source);
  const workspace = createTestWorkspace([URI.file(dir)]).set(note);
  for (const [name, body] of [
    ['Parent', '---\naliases: [parent]\n---\n![[Child]]'],
    ['Outer', '![[Parent]]'],
  ]) {
    const nestedUri = URI.file(path.join(dir, name + '.md'));
    writeFileSync(nestedUri.toFsPath(), body);
    workspace.set(parser.parse(nestedUri, body));
  }
  const graph = FoamGraph.fromWorkspace(workspace, false);
  try {
    const md = createFoamMarkdownIt(
      {
        workspace,
        graph,
        parser,
        linkResolver: ({ resource }) => ({ href: resource.uri.path }),
        getCurrentResource: () => note,
      },
      MarkdownIt({ html: true })
    );
    check(input => md.render(input));
  } finally {
    graph.dispose();
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('Embedded note content', () => {
  for (const style of [
    'full-inline',
    'full-card',
    'content-inline',
    'content-card',
  ]) {
    it(`omits metadata and preserves the body in ${style}`, () => {
      withNote(
        '---\naliases: [example]\n---\n# Title\n\nFirst body line\n\n# Second\n\nLast body line',
        render => {
          const html = render(`${style}![[Child]]`);
          expect(html).not.toContain('aliases:');
          expect(html).toContain('First body line');
          expect(html).toContain('Last body line');
          expect(html).toContain('Second</h1>');
          expect(html.includes('Title</h1>')).toBe(style.startsWith('full'));
        }
      );
    });
  }
  for (const frontmatter of [
    '---\n---\n',
    '---\n# comment\n---\n',
    '\uFEFF---\r\naliases: [example]\r\n...\r\n',
    '---\nid: 1\n---',
  ]) {
    it(`strips closed metadata ${JSON.stringify(frontmatter)}`, () => {
      const source = frontmatter.endsWith('---')
        ? frontmatter
        : frontmatter + 'First body line';
      withNote(source, render => {
        const html = render('content-inline![[Child]]');
        expect(html).not.toContain('<hr');
        expect(html).not.toContain('aliases:');
        expect(html).not.toContain('id: 1');
        expect(html.includes('First body line')).toBe(
          source.includes('First body line')
        );
      });
    });
  }
  for (const source of [
    'First body line\n\n## Later heading\n\nTail',
    'First body line',
    '',
  ]) {
    it(`keeps titleless content ${JSON.stringify(source)}`, () => {
      withNote(source, render => {
        const html = render('content-inline![[Child]]');
        expect(html.includes('First body line')).toBe(
          source.includes('First body line')
        );
        expect(html.includes('Tail')).toBe(source.includes('Tail'));
      });
    });
  }
  for (const title of [
    '# Title',
    '### Title ###',
    'Title\n=====',
    'Title\n-----',
    'Multi\nline title\n=====',
  ]) {
    it(`removes a leading heading ${JSON.stringify(title)}`, () => {
      withNote(
        `---\nid: 1\n---\n\n${title}\n\nBody\n\n# Sibling\n\nTail`,
        render => {
          const html = render('content-inline![[Child]]');
          expect(html).not.toMatch(/<h[1-6]>Title/);
          expect(html).not.toContain('line title');
          expect(html).toContain('Body');
          expect(html).toContain('Sibling</h1>');
          expect(html).toContain('Tail');
        }
      );
    });
  }
  for (const source of [
    '---\nid: 1\nBody',
    '---\nid: [broken\n---\nBody',
    '---\nordinary prose\n---\nBody',
    'Body\n\n---\nTail',
    '```md\n# Code title\n```\n\nBody',
  ]) {
    it(`preserves non-metadata and malformed input ${JSON.stringify(
      source
    )}`, () => {
      withNote(source, render => {
        expect(render('content-inline![[Child]]')).toContain(
          MarkdownIt({ html: true }).render(source)
        );
      });
    });
  }
  it('omits metadata in nested embeds and preserves resolved links and images', () => {
    withNote(
      '---\nid: 1\n---\n# Child\n\nBody [[Outer]]\n\n![Example](https://example.com/image.png)',
      render => {
        const html = render('![[Outer]]');
        expect(html).toContain('Body');
        expect(html).not.toContain('aliases:');
        expect(html).not.toContain('id: 1');
        expect(html).toContain('/Outer.md');
        expect(html).toContain('https://example.com/image.png');
      }
    );
  });
  it('keeps heading blocks intact even in content mode', () => {
    withNote('---\nid: 1\n---\n# Heading ^heading\n\nBody', render => {
      const html = render('content-inline![[Child#^heading]]');
      expect(html).toContain('Heading</h1>');
      expect(html).toContain('Body');
      expect(html).not.toContain('^heading');
    });
  });
  it('extracts sections and blocks against original lines with metadata', () => {
    withNote(
      '---\nid: 1\n---\n# Title\n\nIntro\n\n## Section\n\nSelected text ^selected\n\n## Other\n\nTail',
      render => {
        for (const input of [
          'full-inline![[Child#Section]]',
          'content-inline![[Child#Section]]',
          'full-inline![[Child#^selected]]',
          'content-inline![[Child#^selected]]',
          'inline![[#Section]]',
        ]) {
          const html = render(input);
          expect(html).toContain('Selected text');
          expect(html).not.toContain('Intro');
          expect(html).not.toContain('Tail');
          expect(html).not.toContain('id: 1');
        }
      }
    );
  });
  it('removes the entire Setext section heading in content mode', () => {
    withNote('# Title\n\nSection\n-------\n\nBody\n\n# Tail', render => {
      const html = render('content-inline![[Child#Section]]');
      expect(html).toContain('Body');
      expect(html).not.toContain('<hr');
      expect(html).not.toContain('Section');
      expect(html).not.toContain('Tail');
    });
  });
});
