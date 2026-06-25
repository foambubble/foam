import { FoamGraph } from '../model/graph';
import { Logger } from '../utils/log';
import { createTestNote, createTestWorkspace } from '../../test/test-utils';
import { renderDqlQuery } from './dql';
import { createMarkdownParser } from '../services/markdown-parser';
import { URI } from '../model/uri';

Logger.setLevel('error');

function makeWorkspaceAndGraph(notes: ReturnType<typeof createTestNote>[]) {
  const workspace = createTestWorkspace();
  notes.forEach(n => workspace.set(n));
  const graph = FoamGraph.fromWorkspace(workspace, false);
  return { workspace, graph };
}

describe('renderDqlQuery — warning escaping', () => {
  it('escapes user-controlled filter text in warnings to prevent HTML injection', () => {
    const { workspace, graph } = makeWorkspaceAndGraph([
      createTestNote({ uri: '/a.md' }),
    ]);

    // The filter targets a note identifier containing an HTML payload. The
    // resulting "not found" warning embeds this string; if it were rendered
    // unescaped the preview would inject the tag into the DOM.
    const { html } = renderDqlQuery(
      `filter:\n  links_to: '<img src=x onerror=alert(1)>'`,
      { workspace, graph, trusted: false, toHref: uri => uri.path }
    );

    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x');
  });

  it('escapes regex source in path-filter warnings', () => {
    const { workspace, graph } = makeWorkspaceAndGraph([
      createTestNote({ uri: '/a.md' }),
    ]);
    const { html } = renderDqlQuery(
      `filter:\n  path: '<script>(a+)+$'`,
      { workspace, graph, trusted: false, toHref: uri => uri.path }
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('renderDqlQuery — source-derived select fields', () => {
  it('accepts `body` and `content` as valid select fields', () => {
    const { workspace, graph } = makeWorkspaceAndGraph([
      createTestNote({ uri: '/a.md', title: 'A' }),
    ]);
    const { html } = renderDqlQuery(
      `filter: '*'\nselect: [title, body, content]`,
      { workspace, graph, trusted: false, toHref: uri => uri.path }
    );
    expect(html).not.toContain('Unknown select field');
  });

  it('accepts `section[<label>]` with a label containing spaces', () => {
    const { workspace, graph } = makeWorkspaceAndGraph([
      createTestNote({ uri: '/a.md', title: 'A' }),
    ]);
    const { html } = renderDqlQuery(
      `filter: '*'\nselect: [title, 'section[My Section]']`,
      { workspace, graph, trusted: false, toHref: uri => uri.path }
    );
    expect(html).not.toContain('Unknown select field');
  });

  it('rejects `section[]` with no label', () => {
    const { workspace, graph } = makeWorkspaceAndGraph([
      createTestNote({ uri: '/a.md', title: 'A' }),
    ]);
    const { html } = renderDqlQuery(
      `filter: '*'\nselect: [title, 'section[]']`,
      { workspace, graph, trusted: false, toHref: uri => uri.path }
    );
    expect(html).toContain('Unknown select field');
  });

  it('rejects an unterminated `section[` pattern', () => {
    const { workspace, graph } = makeWorkspaceAndGraph([
      createTestNote({ uri: '/a.md', title: 'A' }),
    ]);
    const { html } = renderDqlQuery(
      `filter: '*'\nselect: [title, 'section[Foo']`,
      { workspace, graph, trusted: false, toHref: uri => uri.path }
    );
    expect(html).toContain('Unknown select field');
  });
});

// End-to-end: a fence with source-derived fields should produce a rendered
// preview cell. This is what users actually see — the unit tests above pin
// the individual stages, this pins the whole flow.

describe('renderDqlQuery — end to end with source-derived fields', () => {
  const parser = createMarkdownParser();

  // A toy markdown renderer: emits a recognisable wrapper so tests can assert
  // the cell went through it without depending on markdown-it. Real callers
  // pass in a markdown-it `render` function.
  const fakeMd = (md: string) => `<MD>${md.trim()}</MD>`;

  function buildWorkspace(uriPath: string, markdown: string) {
    const note = parser.parse(URI.file(uriPath), markdown);
    const workspace = createTestWorkspace();
    workspace.set(note);
    const graph = FoamGraph.fromWorkspace(workspace, false);
    return { workspace, graph, markdown };
  }

  it('select: [body] renders the note body as a markdown cell', () => {
    const { workspace, graph, markdown } = buildWorkspace(
      '/q.md',
      `---\nstatus: to_ask\n---\n# Question\n\nWhat is X?\n`
    );
    const { html } = renderDqlQuery(`filter: '*'\nselect: [body]`, {
      workspace,
      graph,
      trusted: false,
      toHref: uri => uri.path,
      readSource: () => markdown,
      renderMarkdown: fakeMd,
    });
    expect(html).toContain('<MD># Question');
    expect(html).toContain('What is X?');
    // Frontmatter must not leak into the rendered cell.
    expect(html).not.toContain('status: to_ask');
  });

  it('select: [title, content] renders content alongside the title link', () => {
    const { workspace, graph, markdown } = buildWorkspace(
      '/q.md',
      `# Question\n\nWhat is X?\n`
    );
    const { html } = renderDqlQuery(`filter: '*'\nselect: [title, content]`, {
      workspace,
      graph,
      trusted: false,
      toHref: uri => uri.path,
      readSource: () => markdown,
      renderMarkdown: fakeMd,
    });
    // Two-field select → table, title link in one cell, rendered content cell.
    expect(html).toContain('foam-note-link');
    expect(html).toContain('<MD>What is X?</MD>');
    // `content` strips the H1, so the heading should not be in the rendered cell.
    expect(html).not.toContain('<MD># Question');
  });

  it('select: [section[Question]] renders the named section content', () => {
    const { workspace, graph, markdown } = buildWorkspace(
      '/q.md',
      `# Top\n\n## Question\n\nWhat is X?\n\n## Other\n\nElse.\n`
    );
    const { html } = renderDqlQuery(
      `filter: '*'\nselect:\n  - 'section[Question]'`,
      {
        workspace,
        graph,
        trusted: false,
        toHref: uri => uri.path,
        readSource: () => markdown,
        renderMarkdown: fakeMd,
      }
    );
    expect(html).toContain('What is X?');
    expect(html).not.toContain('Else.');
    expect(html).not.toContain('## Question');
  });

  it('without renderMarkdown, source-derived cells fall back to escaped raw markdown', () => {
    const { workspace, graph, markdown } = buildWorkspace(
      '/q.md',
      `# Question\n\n<script>x</script>\n`
    );
    const { html } = renderDqlQuery(`filter: '*'\nselect: [body]`, {
      workspace,
      graph,
      trusted: false,
      toHref: uri => uri.path,
      readSource: () => markdown,
      // no renderMarkdown
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('renderDqlQuery — column header labels', () => {
  function thText(html: string): string[] {
    return Array.from(html.matchAll(/<th>([\s\S]*?)<\/th>/g)).map(m => m[1]);
  }

  it('beautifies section[X] headers by default', () => {
    const { workspace, graph } = makeWorkspaceAndGraph([
      createTestNote({ uri: '/a.md', title: 'A' }),
    ]);
    const { html } = renderDqlQuery(
      `filter: '*'\nselect: [title, 'section[Decision]']\nformat: table`,
      { workspace, graph, trusted: false, toHref: uri => uri.path }
    );
    expect(thText(html)).toEqual(['title', 'Decision']);
  });

  it('beautifies properties.X headers by default', () => {
    const { workspace, graph } = makeWorkspaceAndGraph([
      createTestNote({ uri: '/a.md', title: 'A' }),
    ]);
    const { html } = renderDqlQuery(
      `filter: '*'\nselect: [title, properties.Status]\nformat: table`,
      { workspace, graph, trusted: false, toHref: uri => uri.path }
    );
    expect(thText(html)).toEqual(['title', 'Status']);
  });

  it('uses the explicit label from { field, label } object form', () => {
    const { workspace, graph } = makeWorkspaceAndGraph([
      createTestNote({ uri: '/a.md', title: 'A' }),
    ]);
    const { html } = renderDqlQuery(
      [
        `filter: '*'`,
        `select:`,
        `  - title`,
        `  - field: section[Decision]`,
        `    label: Chosen Decision`,
        `  - field: properties.Status`,
        `    label: Question status`,
        `format: table`,
      ].join('\n'),
      { workspace, graph, trusted: false, toHref: uri => uri.path }
    );
    expect(thText(html)).toEqual([
      'title',
      'Chosen Decision',
      'Question status',
    ]);
  });

  it('escapes label HTML in headers', () => {
    const { workspace, graph } = makeWorkspaceAndGraph([
      createTestNote({ uri: '/a.md', title: 'A' }),
    ]);
    const { html } = renderDqlQuery(
      [
        `filter: '*'`,
        `select:`,
        `  - field: title`,
        `    label: '<script>x</script>'`,
        `format: table`,
      ].join('\n'),
      { workspace, graph, trusted: false, toHref: uri => uri.path }
    );
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
  });

  it('keeps sort working against the raw field expression when a label is set', () => {
    const { workspace, graph } = makeWorkspaceAndGraph([
      createTestNote({ uri: '/a.md', title: 'A', properties: { rank: 2 } }),
      createTestNote({ uri: '/b.md', title: 'B', properties: { rank: 1 } }),
    ]);
    const { html } = renderDqlQuery(
      [
        `filter: '*'`,
        `select:`,
        `  - title`,
        `  - field: properties.rank`,
        `    label: Rank`,
        `sort: properties.rank ASC`,
        `format: table`,
      ].join('\n'),
      { workspace, graph, trusted: false, toHref: uri => uri.path }
    );
    // First data row should be B (rank 1)
    const firstRowIdx = html.indexOf('<tbody>');
    const tbody = html.slice(firstRowIdx);
    const firstRow = tbody.slice(0, tbody.indexOf('</tr>'));
    expect(firstRow).toContain('>B<');
  });

  it('rejects an object entry without a `field` key', () => {
    const { workspace, graph } = makeWorkspaceAndGraph([
      createTestNote({ uri: '/a.md', title: 'A' }),
    ]);
    const { html } = renderDqlQuery(
      [
        `filter: '*'`,
        `select:`,
        `  - title`,
        `  - label: orphan`,
        `format: table`,
      ].join('\n'),
      { workspace, graph, trusted: false, toHref: uri => uri.path }
    );
    expect(html).toContain('Unknown select field');
  });
});
