import MarkdownIt from 'markdown-it';
import { markdownItBlockAnchorIds } from './block-anchor-ids';

const md = markdownItBlockAnchorIds(MarkdownIt());

describe('block anchor id injection', () => {
  describe('id attribute on block elements', () => {
    it('adds id to a paragraph with a block anchor', () => {
      // id uses bare blockId (no '^') so CSS querySelector doesn't throw
      expect(md.render('Some text ^myblock')).toBe(
        '<p id="__myblock">Some text</p>\n'
      );
    });

    it('adds id to the last line of a multi-line paragraph', () => {
      expect(md.render('Line one\nLine two ^multiblock')).toBe(
        '<p id="__multiblock">Line one\nLine two</p>\n'
      );
    });

    it('adds id to a tight list item', () => {
      expect(md.render('- Item ^listblock')).toBe(
        '<ul>\n<li id="__listblock">Item</li>\n</ul>\n'
      );
    });

    it('adds id to the paragraph inside a blockquote', () => {
      expect(md.render('> Quote text ^quoteblock')).toBe(
        '<blockquote>\n<p id="__quoteblock">Quote text</p>\n</blockquote>\n'
      );
    });

    it('inserts a standalone anchor before a heading instead of setting id', () => {
      const result = md.render('## My Heading ^headingblock');
      expect(result).toContain('<a id="__headingblock" aria-hidden="true"></a>');
      expect(result).toContain('<h2>My Heading</h2>');
      // The anchor must appear before the heading tag
      expect(result.indexOf('<a id="headingblock"')).toBeLessThan(
        result.indexOf('<h2>')
      );
    });

    it('supports hyphens in block IDs', () => {
      expect(md.render('A paragraph ^my-block-id')).toBe(
        '<p id="__my-block-id">A paragraph</p>\n'
      );
    });
  });

  describe('stripping the marker from visible text', () => {
    it('strips the ^id marker from paragraph text', () => {
      expect(md.render('Visible text ^hidden-id')).toBe(
        '<p id="__hidden-id">Visible text</p>\n'
      );
    });

    it('strips the ^id marker from list item text', () => {
      expect(md.render('- Item label ^listid')).toBe(
        '<ul>\n<li id="__listid">Item label</li>\n</ul>\n'
      );
    });

    it('strips the ^id marker from heading text but keeps the anchor element', () => {
      const result = md.render('## Heading ^headid');
      expect(result).toContain('<a id="__headid" aria-hidden="true"></a>');
      expect(result).toContain('<h2>Heading</h2>');
      expect(result).not.toContain('Heading ^headid');
    });
  });

  describe('non-interference', () => {
    it('does not add id to a paragraph without a block anchor', () => {
      expect(md.render('Just a paragraph')).toBe('<p>Just a paragraph</p>\n');
    });

    it('does not treat ^id in the middle of a paragraph as an anchor', () => {
      const result = md.render('Text ^notanid more text after');
      expect(result).toBe('<p>Text ^notanid more text after</p>\n');
    });

    it('does not interfere with multiple blocks in the same document', () => {
      const result = md.render(
        'First ^first\n\nSecond ^second\n\nNo anchor here'
      );
      expect(result).toContain('<p id="__first">First</p>');
      expect(result).toContain('<p id="__second">Second</p>');
      expect(result).toContain('<p>No anchor here</p>');
    });
  });

  describe('full-line block IDs (Obsidian-compatible)', () => {
    it('inserts anchor before a code fence with a standalone ^id paragraph after it', () => {
      const result = md.render('```js\nconsole.log("hi");\n```\n^mycode');
      expect(result).toContain('<a id="__mycode" aria-hidden="true"></a>');
      expect(result).toContain('<code class="language-js">');
      // The standalone ^id paragraph must not appear in the output
      expect(result).not.toContain('^mycode');
      // Anchor must appear before the code block
      expect(result.indexOf('<a id="__mycode"')).toBeLessThan(
        result.indexOf('<code')
      );
    });

    it('does not treat standalone ^id as anchor when separated from fence by blank line', () => {
      const result = md.render('```\ncode\n```\n\n^mycode');
      // Blank line means it's a regular paragraph, not a block anchor
      expect(result).not.toContain('<a id="__mycode"');
    });

    it('removes the ^id table row and inserts an anchor before the table', () => {
      const result = md.render('| A | B |\n| - | - |\n| 1 | 2 |\n^mytable');
      expect(result).toContain('<a id="__mytable" aria-hidden="true"></a>');
      expect(result).toContain('<table>');
      // The ^id row must not appear as a table cell
      expect(result).not.toContain('^mytable');
      // Anchor must appear before the table
      expect(result.indexOf('<a id="__mytable"')).toBeLessThan(
        result.indexOf('<table>')
      );
    });

    it('strips ^id from the last list item and sets id on the list element', () => {
      const result = md.render('- Item one\n- Item two\n^mylist');
      expect(result).toContain('<ul id="__mylist">');
      expect(result).not.toContain('^mylist');
    });

    it('strips ^id from the last ordered list item and sets id on the list', () => {
      const result = md.render('1. First\n2. Second\n^orderedlist');
      expect(result).toContain('<ol id="__orderedlist">');
      expect(result).not.toContain('^orderedlist');
    });
  });
});
