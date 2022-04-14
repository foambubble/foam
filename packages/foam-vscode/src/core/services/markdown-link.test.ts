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
      expect(edit.selection).toEqual(link.range);
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
      expect(edit.selection).toEqual(link.range);
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
      expect(edit.selection).toEqual(link.range);
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
      expect(edit.selection).toEqual(link.range);
    });
    it('should be able to rename the alias', () => {
      const link = parser.parse(getRandomURI(), `this is a [[wikilink|alias]]`)
        .links[0];
      const edit = MarkdownLink.createUpdateLinkEdit(link, {
        alias: 'new-alias',
      });
      expect(edit.newText).toEqual(`[[wikilink|new-alias]]`);
      expect(edit.selection).toEqual(link.range);
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
      expect(edit.selection).toEqual(link.range);
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
      expect(edit.selection).toEqual(link.range);
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
      expect(edit.selection).toEqual(link.range);
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
      expect(edit.selection).toEqual(link.range);
    });
  });
});
