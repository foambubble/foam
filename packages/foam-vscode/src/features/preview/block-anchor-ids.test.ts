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
});
