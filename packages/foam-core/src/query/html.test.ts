import { escapeHtml, renderList, renderTable, renderResults } from './html';
import { ResourceView } from '.';
import { URI } from '../model/uri';

// `renderList` / `renderTable` route markdown-bearing fields (`body`, `content`,
// `section[...]`) through the injected `renderMarkdown` callback. Other fields
// keep going through `escapeHtml`. Absent callback → escaped raw markdown.

describe('renderList / renderTable — markdown-bearing fields', () => {
  const identity = (p: string) => p;
  const fakeMd = (md: string) => `<p>RENDERED:${md}</p>`;

  const rows: ResourceView[] = [
    {
      uri: URI.file('/q1.md'),
      title: 'Q1',
      body: '# Q1\n\nWhat is X?',
      content: 'What is X?',
      'section[Question]': 'What is X?',
    },
  ];

  it('renderList pipes `body` through renderMarkdown', () => {
    const html = renderList(rows, ['title', 'body'], identity, fakeMd);
    expect(html).toContain('RENDERED:# Q1');
    expect(html).not.toContain('&lt;p&gt;'); // not double-escaped
  });

  it('renderList pipes `content` through renderMarkdown', () => {
    const html = renderList(rows, ['content'], identity, fakeMd);
    expect(html).toContain('RENDERED:What is X?');
  });

  it('renderList pipes `section[...]` through renderMarkdown', () => {
    const html = renderList(rows, ['section[Question]'], identity, fakeMd);
    expect(html).toContain('RENDERED:What is X?');
  });

  it('renderTable pipes markdown fields through renderMarkdown in cells', () => {
    const html = renderTable(rows, ['title', 'body'], identity, fakeMd);
    expect(html).toContain('RENDERED:# Q1');
  });

  it('without a renderMarkdown callback, markdown fields fall back to escaped text', () => {
    const rowsWithHtmlInBody: ResourceView[] = [
      {
        uri: URI.file('/x.md'),
        title: 'X',
        body: '<script>alert(1)</script>',
      },
    ];
    const html = renderList(rowsWithHtmlInBody, ['body'], identity);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('non-markdown fields stay escaped even when renderMarkdown is provided', () => {
    const rowsWithHtmlInTitle: ResourceView[] = [
      { uri: URI.file('/x.md'), title: '<b>raw</b>' },
    ];
    const html = renderList(
      rowsWithHtmlInTitle,
      ['title'],
      identity,
      fakeMd
    );
    expect(html).not.toContain('RENDERED:');
    expect(html).toContain('&lt;b&gt;raw&lt;/b&gt;');
  });
});

describe('renderResults — format dispatch with markdown fields', () => {
  const identity = (p: string) => p;
  const fakeMd = (md: string) => `<p>R:${md}</p>`;

  it('list format threads renderMarkdown to the list renderer', () => {
    const rows: ResourceView[] = [
      { uri: URI.file('/q1.md'), title: 'Q1', body: '# Q1' },
    ];
    const html = renderResults(
      rows,
      { select: ['body'], format: 'list' },
      identity,
      fakeMd
    );
    expect(html).toContain('R:# Q1');
  });

  it('table format threads renderMarkdown to the table renderer', () => {
    const rows: ResourceView[] = [
      { uri: URI.file('/q1.md'), title: 'Q1', body: '# Q1' },
    ];
    const html = renderResults(
      rows,
      { select: ['title', 'body'], format: 'table' },
      identity,
      fakeMd
    );
    expect(html).toContain('R:# Q1');
  });
});

describe('renderList / renderTable — title fallback', () => {
  const identity = (p: string) => p;

  it('renderList falls back to the basename when the title is missing', () => {
    const rows: ResourceView[] = [
      { uri: URI.file('/notes/alpha.md') /* no title */ },
    ];
    const html = renderList(rows, ['title'], identity);
    expect(html).toContain('alpha.md');
  });

  it('renderTable falls back to the basename when the title is missing', () => {
    const rows: ResourceView[] = [
      { uri: URI.file('/notes/alpha.md') /* no title */ },
    ];
    const html = renderTable(rows, ['title'], identity);
    expect(html).toContain('foam-note-link');
    // The cell text — not just the href — must contain the basename.
    // Match the visible link content between `>...<` so we don't pass on the
    // basename appearing only inside the href attribute.
    expect(html).toMatch(/>alpha\.md</);
  });

  it('renderTable shows an "untitled" placeholder when title is missing and the URI has no basename', () => {
    // Defensive fallback for an effectively unnamed resource — the cell must
    // still contain visible text rather than an empty anchor.
    const rows: ResourceView[] = [{ uri: URI.file('/') }];
    const html = renderTable(rows, ['title'], identity);
    expect(html).toContain('untitled');
  });
});

describe('escapeHtml', () => {
  it('escapes the five HTML special characters so output is safe inside both double- and single-quoted attributes', () => {
    expect(escapeHtml(`& < > " '`)).toBe('&amp; &lt; &gt; &quot; &#39;');
  });
});
