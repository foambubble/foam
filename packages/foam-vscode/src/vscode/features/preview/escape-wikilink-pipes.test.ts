/* @unit-ready */
import MarkdownIt from 'markdown-it';
import markdownItRegex from 'markdown-it-regex';
import {
  default as escapeWikilinkPipes,
  PIPE_PLACEHOLDER,
} from './escape-wikilink-pipes';

/**
 * A stand-in for the other Foam inline plugins (wikilink embed/navigation),
 * which run as markdown-it-regex INLINE rules and split wikilink content on `|`
 * to extract the alias. If encode/decode leaves a placeholder in the content
 * these inline rules see, the alias is lost — so this composition guards that.
 */
const aliasRenderingPlugin = (md: MarkdownIt) =>
  md.use(markdownItRegex, {
    name: 'render-alias',
    regex: /\[\[([^[\]]+?)\]\]/,
    replace: (content: string) => {
      const alias = content.includes('|') ? content.split('|')[1] : content;
      return `<a>${alias}</a>`;
    },
  });

describe('escape-wikilink-pipes plugin', () => {
  it('should render table with wikilink alias correctly', () => {
    const md = MarkdownIt();
    escapeWikilinkPipes(md);

    const markdown = `| Column |
| --- |
| [[note|alias]] |`;

    const html = md.render(markdown);

    // Should have proper table structure
    expect(html).toContain('<table>');
    expect(html).toContain('<tbody>');

    // Should preserve the wikilink with pipe character intact
    expect(html).toContain('[[note|alias]]');

    // Should NOT split into multiple cells (would see extra <td> tags)
    const tdCount = (html.match(/<td>/g) || []).length;
    expect(tdCount).toBe(1);
  });

  it('should render table with multiple wikilink aliases in same row', () => {
    const md = MarkdownIt();
    escapeWikilinkPipes(md);

    const markdown = `| Col1 | Col2 | Col3 |
| --- | --- | --- |
| [[a|A]] | [[b|B]] | [[c|C]] |`;

    const html = md.render(markdown);

    // All three wikilinks should be preserved
    expect(html).toContain('[[a|A]]');
    expect(html).toContain('[[b|B]]');
    expect(html).toContain('[[c|C]]');

    // Should have exactly 3 cells in body row
    const bodyMatch = html.match(/<tbody>(.*?)<\/tbody>/s);
    expect(bodyMatch).toBeTruthy();
    const bodyCells = (bodyMatch[0].match(/<td>/g) || []).length;
    expect(bodyCells).toBe(3);
  });

  it('should render table with wikilink containing section and alias', () => {
    const md = MarkdownIt();
    escapeWikilinkPipes(md);

    const markdown = `| Link |
| --- |
| [[note#section|alias text]] |`;

    const html = md.render(markdown);

    // Wikilink with section and alias should be intact
    expect(html).toContain('[[note#section|alias text]]');

    // Should be in a single cell
    const bodyMatch = html.match(/<tbody>(.*?)<\/tbody>/s);
    const bodyCells = (bodyMatch[0].match(/<td>/g) || []).length;
    expect(bodyCells).toBe(1);
  });

  it('should render table with embed wikilink alias correctly', () => {
    const md = MarkdownIt();
    escapeWikilinkPipes(md);

    const markdown = `| Embed |
| --- |
| ![[image|caption]] |`;

    const html = md.render(markdown);

    // Embed wikilink should be preserved
    expect(html).toContain('![[image|caption]]');
  });

  it('should not affect wikilinks without aliases', () => {
    const md = MarkdownIt();
    escapeWikilinkPipes(md);

    const markdown = `| Link |
| --- |
| [[note-without-alias]] |`;

    const html = md.render(markdown);

    // Regular wikilink should still work
    expect(html).toContain('[[note-without-alias]]');
  });

  it('should not affect wikilinks outside of tables', () => {
    const md = MarkdownIt();
    escapeWikilinkPipes(md);

    const markdown = `
Paragraph with [[note|alias]] link.

| Column |
| --- |
| [[table-note|table-alias]] |

Another [[note2|alias2]] paragraph.
`;

    const html = md.render(markdown);

    // All wikilinks should be preserved
    expect(html).toContain('[[note|alias]]');
    expect(html).toContain('[[table-note|table-alias]]');
    expect(html).toContain('[[note2|alias2]]');
  });

  it('should handle table with mixed content and wikilinks', () => {
    const md = MarkdownIt();
    escapeWikilinkPipes(md);

    const markdown = `| Text | Link | Mixed |
| --- | --- | --- |
| plain text | [[note|alias]] | text [[link|L]] more |`;

    const html = md.render(markdown);

    // Both wikilinks should be preserved
    expect(html).toContain('[[note|alias]]');
    expect(html).toContain('[[link|L]]');

    // Should have 3 cells
    const bodyMatch = html.match(/<tbody>(.*?)<\/tbody>/s);
    const bodyCells = (bodyMatch[0].match(/<td>/g) || []).length;
    expect(bodyCells).toBe(3);
  });

  it('should handle tables without wikilinks', () => {
    const md = MarkdownIt();
    escapeWikilinkPipes(md);

    const markdown = `| Col1 | Col2 |
| --- | --- |
| text | more |`;

    const html = md.render(markdown);

    // Should render normal table
    expect(html).toContain('<table>');
    expect(html).toContain('text');
    expect(html).toContain('more');
  });

  it('should not leave placeholder character in rendered output', () => {
    const md = MarkdownIt();
    escapeWikilinkPipes(md);

    const markdown = `| Col1 | Col2 |
| --- | --- |
| [[a|A]] | [[b|B]] |`;

    const html = md.render(markdown);

    // Should not contain the internal placeholder
    expect(html).not.toContain(PIPE_PLACEHOLDER);
  });

  it('should handle complex wikilink aliases with special characters', () => {
    const md = MarkdownIt();
    escapeWikilinkPipes(md);

    const markdown = `| Link |
| --- |
| [[note-with-dashes|Alias with spaces & special!]] |`;

    const html = md.render(markdown);

    expect(html).toContain(
      '[[note-with-dashes|Alias with spaces &amp; special!]]'
    );
  });

  it('should handle multiple rows with wikilink aliases', () => {
    const md = MarkdownIt();
    escapeWikilinkPipes(md);

    const markdown = `| Links |
| --- |
| [[note1|alias1]] |
| [[note2|alias2]] |
| [[note3|alias3]] |`;

    const html = md.render(markdown);

    // All three should be preserved
    expect(html).toContain('[[note1|alias1]]');
    expect(html).toContain('[[note2|alias2]]');
    expect(html).toContain('[[note3|alias3]]');

    // Should have 3 rows in tbody
    const bodyMatch = html.match(/<tbody>(.*?)<\/tbody>/s);
    const bodyRows = (bodyMatch[0].match(/<tr>/g) || []).length;
    expect(bodyRows).toBe(3);
  });

  it('should work when markdown-it does not have table support', () => {
    const md = MarkdownIt();
    md.disable(['table']);

    // Should not throw when table rule doesn't exist
    expect(() => escapeWikilinkPipes(md)).not.toThrow();
  });

  it('lets downstream inline plugins see real pipes (alias survives) inside tables', () => {
    // Composition guard: encode must not leave a placeholder visible to the
    // other Foam inline plugins, or wikilink aliases break.
    const md = MarkdownIt();
    escapeWikilinkPipes(md);
    aliasRenderingPlugin(md);

    const html = md.render(`| Col |
| --- |
| [[note|Alias]] |`);

    expect(html).toContain('<a>Alias</a>');
    expect(html).not.toContain(PIPE_PLACEHOLDER);
    // Table stays a single cell (the pipe wasn't treated as a column divider).
    expect((html.match(/<td>/g) || []).length).toBe(1);
  });

  it('lets downstream inline plugins see real pipes (alias survives) outside tables', () => {
    const md = MarkdownIt();
    escapeWikilinkPipes(md);
    aliasRenderingPlugin(md);

    const html = md.render('A paragraph with [[note|Alias]] inline.');

    expect(html).toContain('<a>Alias</a>');
    expect(html).not.toContain(PIPE_PLACEHOLDER);
  });

  it('renders a large list-heavy document in linear time (no O(n^2) rescan)', () => {
    // Regression guard for the freeze in #1689. markdown-it invokes the table
    // block rule as a candidate on EVERY list-item line; the plugin used to
    // re-scan the whole (~MB) document source on each invocation, giving
    // O(lines * docSize) — a multi-second freeze on a large daily note. The
    // content below mirrors the profile that surfaced this: thousands of list
    // items with wikilinks, in a large document.
    const md = MarkdownIt();
    escapeWikilinkPipes(md);

    const para =
      'Name his fixed returning little [[vessel dtitle]] to. Of [[grand]] and ' +
      'could opened. From there as nearly which [[hopes imagidne]]. The ' +
      '[[relation ddressed]] at her plainly. Of him by disposition ' +
      '[[addition Spain]] called and much more prose to add length to the line.';
    const big = Array.from({ length: 4500 }, (_, i) => `- ${i} ${para}`).join(
      '\n'
    );

    const start = Date.now();
    const html = md.render(big);
    const elapsed = Date.now() - start;

    // O(n) finishes in well under a second; the old O(lines*docSize) took
    // several seconds on this exact shape. Generous ceiling for CI noise while
    // still catching the quadratic.
    expect(elapsed).toBeLessThan(1500);
    expect(html).toContain('[[vessel dtitle]]');
    expect(html).not.toContain(PIPE_PLACEHOLDER);
  });

  it('renders a large table with piped wikilinks in linear time', () => {
    // The other axis: a big table full of piped wikilinks. Each row invokes the
    // table rule; the old code re-scanned the whole doc per invocation.
    const md = MarkdownIt();
    escapeWikilinkPipes(md);

    const rows = Array.from(
      { length: 2000 },
      (_, i) => `| [[note-${i}|alias ${i}]] | [[b-${i}|B ${i}]] |`
    );
    const big = ['| A | B |', '| --- | --- |', ...rows].join('\n');

    const start = Date.now();
    const html = md.render(big);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(1500);
    expect(html).toContain('[[note-0|alias 0]]');
    expect(html).not.toContain(PIPE_PLACEHOLDER);
  });
});
