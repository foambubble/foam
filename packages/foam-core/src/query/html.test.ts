import { escapeHtml, noteLink, renderList, renderTable, renderResults } from './html';
import { ResourceView } from '.';
import { URI } from '../model/uri';

// `renderList` / `renderTable` route markdown-bearing fields (`body`, `content`,
// `section[...]`) through the injected `renderMarkdown` callback. Other fields
// keep going through `escapeHtml`. Absent callback → escaped raw markdown.

// `toHref` test stub: produces a stable href shape for assertions. The contract
// is "host returns the full href string", so the stub returns the URI path
// (callers asserted on `href="/notes/alpha.md"` before the API change and the
// same assertions still hold).
const pathHref = (uri: URI) => uri.path;

describe('renderList / renderTable — markdown-bearing fields', () => {
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
    const html = renderList(rows, ['title', 'body'], pathHref, fakeMd).html;
    expect(html).toContain('RENDERED:# Q1');
    expect(html).not.toContain('&lt;p&gt;'); // not double-escaped
  });

  it('renderList pipes `content` through renderMarkdown', () => {
    const html = renderList(rows, ['content'], pathHref, fakeMd).html;
    expect(html).toContain('RENDERED:What is X?');
  });

  it('renderList pipes `section[...]` through renderMarkdown', () => {
    const html = renderList(rows, ['section[Question]'], pathHref, fakeMd).html;
    expect(html).toContain('RENDERED:What is X?');
  });

  it('renderTable pipes markdown fields through renderMarkdown in cells', () => {
    const html = renderTable(rows, ['title', 'body'], pathHref, fakeMd).html;
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
    const html = renderList(rowsWithHtmlInBody, ['body'], pathHref).html;
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('non-markdown fields stay escaped even when renderMarkdown is provided', () => {
    const rowsWithHtmlInTitle: ResourceView[] = [
      { uri: URI.file('/x.md'), title: '<b>raw</b>' },
    ];
    const { html } = renderList(
      rowsWithHtmlInTitle,
      ['title'],
      pathHref,
      fakeMd
    );
    expect(html).not.toContain('RENDERED:');
    expect(html).toContain('&lt;b&gt;raw&lt;/b&gt;');
  });
});

describe('renderResults — format dispatch with markdown fields', () => {
  const fakeMd = (md: string) => `<p>R:${md}</p>`;

  it('list format threads renderMarkdown to the list renderer', () => {
    const rows: ResourceView[] = [
      { uri: URI.file('/q1.md'), title: 'Q1', body: '# Q1' },
    ];
    const { html, shape } = renderResults(
      rows,
      { select: ['body'], format: 'list' },
      pathHref,
      fakeMd
    );
    expect(html).toContain('R:# Q1');
    expect(shape).toBe('list');
  });

  it('table format threads renderMarkdown to the table renderer', () => {
    const rows: ResourceView[] = [
      { uri: URI.file('/q1.md'), title: 'Q1', body: '# Q1' },
    ];
    const { html, shape } = renderResults(
      rows,
      { select: ['title', 'body'], format: 'table' },
      pathHref,
      fakeMd
    );
    expect(html).toContain('R:# Q1');
    expect(shape).toBe('table');
  });
});

describe('renderList / renderTable — title fallback', () => {
  it('renderList falls back to the basename when the title is missing', () => {
    const rows: ResourceView[] = [
      { uri: URI.file('/notes/alpha.md') /* no title */ },
    ];
    const html = renderList(rows, ['title'], pathHref).html;
    expect(html).toContain('alpha.md');
  });

  it('renderTable falls back to the basename when the title is missing', () => {
    const rows: ResourceView[] = [
      { uri: URI.file('/notes/alpha.md') /* no title */ },
    ];
    const html = renderTable(rows, ['title'], pathHref).html;
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
    const html = renderTable(rows, ['title'], pathHref).html;
    expect(html).toContain('untitled');
  });
});

describe('renderList / renderTable — per-entry link override', () => {
  const rows: ResourceView[] = [
    {
      uri: URI.file('/notes/alpha.md'),
      title: 'Alpha',
      filename: 'alpha',
      folder: '/notes',
    },
  ];

  it('renderTable links a non-title field when the entry sets link: true', () => {
    // Opt-in: a user who explicitly wants `filename` clickable can ask for it
    // without losing the "filename is data" default behaviour.
    const html = renderTable(
      rows,
      ['title', { field: 'filename', link: true }],
      pathHref
    ).html;
    // Both the title cell AND the filename cell now contain anchors.
    expect(html.match(/foam-note-link/g)?.length).toBe(2);
    // Title anchor uses the title text; filename anchor uses the filename value.
    expect(html).toMatch(/>Alpha</);
    expect(html).toMatch(/>alpha</);
  });

  it('renderTable renders title as plain text when the entry sets link: false', () => {
    // Opt-out: the explicit override on `title` keeps the cell text-only.
    const html = renderTable(
      rows,
      [{ field: 'title', link: false }],
      pathHref
    ).html;
    expect(html).not.toContain('foam-note-link');
    // The title text is still visible — opt-out only removes the anchor.
    expect(html).toContain('Alpha');
  });

  it('renderList links a non-title field when the entry sets link: true', () => {
    const html = renderList(
      rows,
      [{ field: 'filename', link: true }],
      pathHref
    ).html;
    expect(html).toContain('foam-note-link');
    expect(html).toContain('>alpha<');
  });

  it('renderList renders title as plain text when the entry sets link: false', () => {
    const html = renderList(
      rows,
      [{ field: 'title', link: false }],
      pathHref
    ).html;
    expect(html).not.toContain('foam-note-link');
    expect(html).toContain('Alpha');
  });

  it('non-title fields stay plain text without an explicit link: true', () => {
    // Default behaviour is unchanged: `filename` as a bare string is data.
    const html = renderTable(rows, ['title', 'filename'], pathHref).html;
    expect(html.match(/foam-note-link/g)?.length).toBe(1); // only title
  });
});

describe('escapeHtml', () => {
  it('escapes the five HTML special characters so output is safe inside both double- and single-quoted attributes', () => {
    expect(escapeHtml(`& < > " '`)).toBe('&amp; &lt; &gt; &quot; &#39;');
  });
});

describe('noteLink', () => {
  it('uses the href returned by toHref as-is — the host owns the full href shape', () => {
    const html = noteLink(
      'Alpha',
      URI.file('/notes/alpha.md'),
      uri => `/${uri.path.replace(/^\//, '')}`
    );
    expect(html).toContain('href="/notes/alpha.md"');
    expect(html).toContain('data-href="/notes/alpha.md"');
  });

  it('lets toHref return a `#fragment` so callers can target in-page anchors directly', () => {
    const html = noteLink('Alpha', URI.file('/notes/alpha.md'), () => '#note-alpha');
    expect(html).toContain('href="#note-alpha"');
    expect(html).toContain('data-href="#note-alpha"');
  });

  it('renders escaped plain text when toHref returns null (the "no link" signal)', () => {
    const html = noteLink('Alpha & co', URI.file('/notes/alpha.md'), () => null);
    expect(html).toBe('Alpha &amp; co');
  });

  it('also falls back to escaped plain text when toHref throws (safety net)', () => {
    const html = noteLink('Alpha & co', URI.file('/notes/alpha.md'), () => {
      throw new Error('boom');
    });
    expect(html).toBe('Alpha &amp; co');
  });

  it('exposes the URI fragment to toHref so callers can build per-section anchors', () => {
    const uri = URI.file('/notes/alpha.md').with({ fragment: 'intro' });
    const html = noteLink('Alpha intro', uri, u =>
      u.fragment ? `#${u.path}--${u.fragment}` : `#${u.path}`
    );
    expect(html).toContain('href="#/notes/alpha.md--intro"');
  });

  it('escapes a host-supplied href containing an HTML attribute breaker', () => {
    // The toHref contract says hosts return the href verbatim — including
    // potentially-unsafe characters like `"` (e.g. a CLI handing back
    // `uri.path` for a workspace where a note is named `Q "Quoted" Memo.md`).
    // `noteLink` applies attribute-boundary escaping so a quote can't close
    // the `href=` attribute and inject markup.
    const html = noteLink(
      'Quoted',
      URI.file('/notes/q.md'),
      () => '/path/with"quote.md'
    );
    expect(html).toContain('href="/path/with&quot;quote.md"');
    expect(html).toContain('data-href="/path/with&quot;quote.md"');
    expect(html).not.toContain('with"quote');
  });
});
