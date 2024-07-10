import { getRandomURI } from '../../test/test-utils';
import { ResourceLink } from '../model/note';
import { Range } from '../model/range';
import { createMarkdownParser } from '../services/markdown-parser';
import { MarkdownLink } from './markdown-link';

describe('MarkdownLink', () => {
  const parser = createMarkdownParser([]);
  describe('parse wikilink', () => {
    it('should parse target', () => {
      const link = parser.parse(getRandomURI(), `this is a [[wikilink]]`)
        .links[0];
      const parsed = MarkdownLink.analyzeLink(link);
      expect(parsed.target).toEqual('wikilink');
      expect(parsed.section).toEqual('');
      expect(parsed.alias).toEqual('');
    });
    it('should parse target and section', () => {
      const link = parser.parse(
        getRandomURI(),
        `this is a [[wikilink#section]]`
      ).links[0];
      const parsed = MarkdownLink.analyzeLink(link);
      expect(parsed.target).toEqual('wikilink');
      expect(parsed.section).toEqual('section');
      expect(parsed.alias).toEqual('');
    });
    it('should parse target and alias', () => {
      const link = parser.parse(getRandomURI(), `this is a [[wikilink|alias]]`)
        .links[0];
      const parsed = MarkdownLink.analyzeLink(link);
      expect(parsed.target).toEqual('wikilink');
      expect(parsed.section).toEqual('');
      expect(parsed.alias).toEqual('alias');
    });
    it('should parse links with square brackets #975', () => {
      const link = parser.parse(
        getRandomURI(),
        `this is a [[wikilink [with] brackets]]`
      ).links[0];
      const parsed = MarkdownLink.analyzeLink(link);
      expect(parsed.target).toEqual('wikilink [with] brackets');
      expect(parsed.section).toEqual('');
      expect(parsed.alias).toEqual('');
    });
    it('should parse links with square brackets in alias #975', () => {
      const link = parser.parse(
        getRandomURI(),
        `this is a [[wikilink|alias [with] brackets]]`
      ).links[0];
      const parsed = MarkdownLink.analyzeLink(link);
      expect(parsed.target).toEqual('wikilink');
      expect(parsed.section).toEqual('');
      expect(parsed.alias).toEqual('alias [with] brackets');
    });
    it('should parse target and alias with escaped separator', () => {
      const link = parser.parse(
        getRandomURI(),
        `this is a [[wikilink\\|alias]]`
      ).links[0];
      const parsed = MarkdownLink.analyzeLink(link);
      expect(parsed.target).toEqual('wikilink');
      expect(parsed.section).toEqual('');
      expect(parsed.alias).toEqual('alias');
    });
    it('should parse target section and alias', () => {
      const link = parser.parse(
        getRandomURI(),
        `this is a [[wikilink with spaces#section with spaces|alias with spaces]]`
      ).links[0];
      const parsed = MarkdownLink.analyzeLink(link);
      expect(parsed.target).toEqual('wikilink with spaces');
      expect(parsed.section).toEqual('section with spaces');
      expect(parsed.alias).toEqual('alias with spaces');
    });
    it('should parse section', () => {
      const link = parser.parse(getRandomURI(), `this is a [[#section]]`)
        .links[0];
      const parsed = MarkdownLink.analyzeLink(link);
      expect(parsed.target).toEqual('');
      expect(parsed.section).toEqual('section');
      expect(parsed.alias).toEqual('');
    });
  });

  describe('parse direct link', () => {
    it('should parse target', () => {
      const link = parser.parse(getRandomURI(), `this is a [link](to/path.md)`)
        .links[0];
      const parsed = MarkdownLink.analyzeLink(link);
      expect(parsed.target).toEqual('to/path.md');
      expect(parsed.section).toEqual('');
      expect(parsed.alias).toEqual('link');
    });
    it('should parse target and section', () => {
      const link = parser.parse(
        getRandomURI(),
        `this is a [link](to/path.md#section)`
      ).links[0];
      const parsed = MarkdownLink.analyzeLink(link);
      expect(parsed.target).toEqual('to/path.md');
      expect(parsed.section).toEqual('section');
      expect(parsed.alias).toEqual('link');
    });
    it('should parse section only', () => {
      const link: ResourceLink = {
        type: 'link',
        rawText: '[link](#section)',
        range: Range.create(0, 0),
        isEmbed: false,
      };
      const parsed = MarkdownLink.analyzeLink(link);
      expect(parsed.target).toEqual('');
      expect(parsed.section).toEqual('section');
      expect(parsed.alias).toEqual('link');
    });
    it('should parse links with square brackets in label #975', () => {
      const link = parser.parse(
        getRandomURI(),
        `this is a [inbox [xyz]](to/path.md)`
      ).links[0];
      const parsed = MarkdownLink.analyzeLink(link);
      expect(parsed.target).toEqual('to/path.md');
      expect(parsed.section).toEqual('');
      expect(parsed.alias).toEqual('inbox [xyz]');
    });
    it('should parse links with empty label #975', () => {
      const link = parser.parse(getRandomURI(), `this is a [](to/path.md)`)
        .links[0];
      const parsed = MarkdownLink.analyzeLink(link);
      expect(parsed.target).toEqual('to/path.md');
      expect(parsed.section).toEqual('');
      expect(parsed.alias).toEqual('');
    });
    it('should parse links with angles #1039', () => {
      const link = parser.parse(getRandomURI(), `this is a [](<to/path.md>)`)
        .links[0];
      const parsed = MarkdownLink.analyzeLink(link);
      expect(parsed.target).toEqual('to/path.md');
      expect(parsed.section).toEqual('');
      expect(parsed.alias).toEqual('');
    });
    it('should parse links with angles and sections #1039', () => {
      const link = parser.parse(
        getRandomURI(),
        `this is a [](<to/path.md#section>)`
      ).links[0];
      const parsed = MarkdownLink.analyzeLink(link);
      expect(parsed.target).toEqual('to/path.md');
      expect(parsed.section).toEqual('section');
      expect(parsed.alias).toEqual('');
    });
  });

  describe('rename wikilink', () => {
    it('should rename the target only', () => {
      const link = parser.parse(
        getRandomURI(),
        `this is a [[wikilink#section]]`
      ).links[0];
      const edit = MarkdownLink.createUpdateLinkEdit(link, {
        target: 'new-link',
      });
      expect(edit.newText).toEqual(`[[new-link#section]]`);
      expect(edit.range).toEqual(link.range);
    });
    it('should rename the section only', () => {
      const link = parser.parse(
        getRandomURI(),
        `this is a [[wikilink#section]]`
      ).links[0];
      const edit = MarkdownLink.createUpdateLinkEdit(link, {
        section: 'new-section',
      });
      expect(edit.newText).toEqual(`[[wikilink#new-section]]`);
      expect(edit.range).toEqual(link.range);
    });
    it('should rename both target and section', () => {
      const link = parser.parse(
        getRandomURI(),
        `this is a [[wikilink#section]]`
      ).links[0];
      const edit = MarkdownLink.createUpdateLinkEdit(link, {
        target: 'new-link',
        section: 'new-section',
      });
      expect(edit.newText).toEqual(`[[new-link#new-section]]`);
      expect(edit.range).toEqual(link.range);
    });
    it('should be able to remove the section', () => {
      const link = parser.parse(
        getRandomURI(),
        `this is a [[wikilink#section]]`
      ).links[0];
      const edit = MarkdownLink.createUpdateLinkEdit(link, {
        section: '',
      });
      expect(edit.newText).toEqual(`[[wikilink]]`);
      expect(edit.range).toEqual(link.range);
    });
    it('should be able to rename the alias', () => {
      const link = parser.parse(getRandomURI(), `this is a [[wikilink|alias]]`)
        .links[0];
      const edit = MarkdownLink.createUpdateLinkEdit(link, {
        alias: 'new-alias',
      });
      expect(edit.newText).toEqual(`[[wikilink|new-alias]]`);
      expect(edit.range).toEqual(link.range);
    });
  });

  describe('rename direct link', () => {
    it('should rename the target only', () => {
      const link = parser.parse(getRandomURI(), `this is a [link](to/path.md)`)
        .links[0];
      const edit = MarkdownLink.createUpdateLinkEdit(link, {
        target: 'to/another-path.md',
      });
      expect(edit.newText).toEqual(`[link](to/another-path.md)`);
      expect(edit.range).toEqual(link.range);
    });
    it('should rename the section only', () => {
      const link = parser.parse(
        getRandomURI(),
        `this is a [link](to/path.md#section)`
      ).links[0];
      const edit = MarkdownLink.createUpdateLinkEdit(link, {
        section: 'section2',
      });
      expect(edit.newText).toEqual(`[link](to/path.md#section2)`);
      expect(edit.range).toEqual(link.range);
    });
    it('should rename both target and section', () => {
      const link = parser.parse(
        getRandomURI(),
        `this is a [link](to/path.md#section)`
      ).links[0];
      const edit = MarkdownLink.createUpdateLinkEdit(link, {
        target: 'to/another-path.md',
        section: 'section2',
      });
      expect(edit.newText).toEqual(`[link](to/another-path.md#section2)`);
      expect(edit.range).toEqual(link.range);
    });
    it('should be able to remove the section', () => {
      const link = parser.parse(
        getRandomURI(),
        `this is a [link](to/path.md#section)`
      ).links[0];
      const edit = MarkdownLink.createUpdateLinkEdit(link, {
        section: '',
      });
      expect(edit.newText).toEqual(`[link](to/path.md)`);
      expect(edit.range).toEqual(link.range);
    });
  });

  describe('convert wikilink to link', () => {
    it('should generate default alias if no one', () => {
      const wikilink = parser.parse(getRandomURI(), `[[wikilink]]`).links[0];
      const wikilinkEdit = MarkdownLink.createUpdateLinkEdit(wikilink, {
        type: 'link',
      });
      expect(wikilinkEdit.newText).toEqual(`[wikilink](wikilink)`);
      expect(wikilinkEdit.range).toEqual(wikilink.range);

      const wikilinkWithSection = parser.parse(
        getRandomURI(),
        `[[wikilink#section]]`
      ).links[0];
      const wikilinkWithSectionEdit = MarkdownLink.createUpdateLinkEdit(
        wikilinkWithSection,
        {
          type: 'link',
        }
      );
      expect(wikilinkWithSectionEdit.newText).toEqual(
        `[wikilink#section](wikilink#section)`
      );
      expect(wikilinkWithSectionEdit.range).toEqual(wikilinkWithSection.range);
    });

    it('should use alias in the wikilik the if there has one', () => {
      const wikilink = parser.parse(
        getRandomURI(),
        `[[wikilink#section|alias]]`
      ).links[0];
      const wikilinkEdit = MarkdownLink.createUpdateLinkEdit(wikilink, {
        type: 'link',
      });
      expect(wikilinkEdit.newText).toEqual(`[alias](wikilink#section)`);
      expect(wikilinkEdit.range).toEqual(wikilink.range);
    });
  });

  describe('convert link to wikilink', () => {
    it('should reorganize target, section, and alias in wikilink manner', () => {
      const link = parser.parse(getRandomURI(), `[link](to/path.md)`).links[0];
      const linkEdit = MarkdownLink.createUpdateLinkEdit(link, {
        type: 'wikilink',
      });
      expect(linkEdit.newText).toEqual(`[[to/path.md|link]]`);
      expect(linkEdit.range).toEqual(link.range);

      const linkWithSection = parser.parse(
        getRandomURI(),
        `[link](to/path.md#section)`
      ).links[0];
      const linkWithSectionEdit = MarkdownLink.createUpdateLinkEdit(
        linkWithSection,
        {
          type: 'wikilink',
        }
      );
      expect(linkWithSectionEdit.newText).toEqual(
        `[[to/path.md#section|link]]`
      );
      expect(linkWithSectionEdit.range).toEqual(linkWithSection.range);
    });

    it('should use alias in the wikilik the if there has one', () => {
      const wikilink = parser.parse(
        getRandomURI(),
        `[[wikilink#section|alias]]`
      ).links[0];
      const wikilinkEdit = MarkdownLink.createUpdateLinkEdit(wikilink, {
        type: 'link',
      });
      expect(wikilinkEdit.newText).toEqual(`[alias](wikilink#section)`);
      expect(wikilinkEdit.range).toEqual(wikilink.range);
    });
  });

  describe('convert to its original type', () => {
    it('should remain unchanged', () => {
      const link = parser.parse(getRandomURI(), `[link](to/path.md#section)`)
        .links[0];
      const linkEdit = MarkdownLink.createUpdateLinkEdit(link, {
        type: 'link',
      });
      expect(linkEdit.newText).toEqual(`[link](to/path.md#section)`);
      expect(linkEdit.range).toEqual(link.range);

      const wikilink = parser.parse(
        getRandomURI(),
        `[[wikilink#section|alias]]`
      ).links[0];
      const wikilinkEdit = MarkdownLink.createUpdateLinkEdit(wikilink, {
        type: 'wikilink',
      });
      expect(wikilinkEdit.newText).toEqual(`[[wikilink#section|alias]]`);
      expect(wikilinkEdit.range).toEqual(wikilink.range);
    });
  });

  describe('change isEmbed property', () => {
    it('should change isEmbed only', () => {
      const wikilink = parser.parse(getRandomURI(), `[[wikilink]]`).links[0];
      const wikilinkEdit = MarkdownLink.createUpdateLinkEdit(wikilink, {
        isEmbed: true,
      });
      expect(wikilinkEdit.newText).toEqual(`![[wikilink]]`);
      expect(wikilinkEdit.range).toEqual(wikilink.range);

      const link = parser.parse(getRandomURI(), `![link](to/path.md)`).links[0];
      const linkEdit = MarkdownLink.createUpdateLinkEdit(link, {
        isEmbed: false,
      });
      expect(linkEdit.newText).toEqual(`[link](to/path.md)`);
      expect(linkEdit.range).toEqual(link.range);
    });

    it('should be unchanged if the update value is the same as the original one', () => {
      const embeddedWikilink = parser.parse(getRandomURI(), `![[wikilink]]`)
        .links[0];
      const embeddedWikilinkEdit = MarkdownLink.createUpdateLinkEdit(
        embeddedWikilink,
        {
          isEmbed: true,
        }
      );
      expect(embeddedWikilinkEdit.newText).toEqual(`![[wikilink]]`);
      expect(embeddedWikilinkEdit.range).toEqual(embeddedWikilink.range);

      const link = parser.parse(getRandomURI(), `[link](to/path.md)`).links[0];
      const linkEdit = MarkdownLink.createUpdateLinkEdit(link, {
        isEmbed: false,
      });
      expect(linkEdit.newText).toEqual(`[link](to/path.md)`);
      expect(linkEdit.range).toEqual(link.range);
    });
  });

  describe('insert angles', () => {
    it('should insert angles when meeting space in links', () => {
      const link = parser.parse(getRandomURI(), `![link](to/path.md)`).links[0];
      const linkAddSection = MarkdownLink.createUpdateLinkEdit(link, {
        section: 'one section',
      });
      expect(linkAddSection.newText).toEqual(
        `![link](<to/path.md#one section>)`
      );
      expect(linkAddSection.range).toEqual(link.range);

      const linkChangingTarget = parser.parse(
        getRandomURI(),
        `[link](to/path.md#one-section)`
      ).links[0];
      const linkEdit = MarkdownLink.createUpdateLinkEdit(linkChangingTarget, {
        target: 'to/another path.md',
      });
      expect(linkEdit.newText).toEqual(
        `[link](<to/another path.md#one-section>)`
      );
      expect(linkEdit.range).toEqual(linkChangingTarget.range);

      const wikilink = parser.parse(getRandomURI(), `[[wikilink#one section]]`)
        .links[0];
      const wikilinkEdit = MarkdownLink.createUpdateLinkEdit(wikilink, {
        type: 'link',
      });
      expect(wikilinkEdit.newText).toEqual(
        `[wikilink#one section](<wikilink#one section>)`
      );
      expect(wikilinkEdit.range).toEqual(wikilink.range);
    });

    it('should not insert angles in wikilink', () => {
      const wikilink = parser.parse(getRandomURI(), `[[wikilink#one section]]`)
        .links[0];
      const wikilinkEdit = MarkdownLink.createUpdateLinkEdit(wikilink, {
        target: 'another wikilink',
      });
      expect(wikilinkEdit.newText).toEqual(`[[another wikilink#one section]]`);
      expect(wikilinkEdit.range).toEqual(wikilink.range);
    });
  });
});
