/* @unit-ready */
import MarkdownIt from 'markdown-it';
import { default as escapeWikilinkPipes, PIPE_PLACEHOLDER } from './escape-wikilink-pipes';

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

    expect(html).toContain('[[note-with-dashes|Alias with spaces &amp; special!]]');
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
});
