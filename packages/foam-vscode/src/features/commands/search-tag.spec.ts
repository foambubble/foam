/* @unit-ready */
import { generateTagSearchPattern } from './search-tag';

describe('search-tag command', () => {
  describe('generateTagSearchPattern', () => {
    it('generates correct regex pattern for simple tag', () => {
      const pattern = generateTagSearchPattern('project-alpha');
      expect(pattern).toBe(
        '#project-alpha\\b|tags:.*?\\bproject-alpha\\b|^\\s*-\\s+project-alpha\\b\\s*$'
      );
    });

    it('escapes special regex characters in tag label', () => {
      const pattern = generateTagSearchPattern('tag.with+special*chars');
      expect(pattern).toBe(
        '#tag\\.with\\+special\\*chars\\b|tags:.*?\\btag\\.with\\+special\\*chars\\b|^\\s*-\\s+tag\\.with\\+special\\*chars\\b\\s*$'
      );
    });

    it('handles hierarchical tags with forward slashes', () => {
      const pattern = generateTagSearchPattern('status/active');
      // Forward slashes don't need escaping in regex
      expect(pattern).toBe(
        '#status/active\\b|tags:.*?\\bstatus/active\\b|^\\s*-\\s+status/active\\b\\s*$'
      );
    });

    it('handles tags with hyphens', () => {
      const pattern = generateTagSearchPattern('v1-release');
      expect(pattern).toBe(
        '#v1-release\\b|tags:.*?\\bv1-release\\b|^\\s*-\\s+v1-release\\b\\s*$'
      );
    });

    it('handles tags with underscores', () => {
      const pattern = generateTagSearchPattern('my_tag');
      expect(pattern).toBe(
        '#my_tag\\b|tags:.*?\\bmy_tag\\b|^\\s*-\\s+my_tag\\b\\s*$'
      );
    });

    it('escapes parentheses', () => {
      const pattern = generateTagSearchPattern('tag(with)parens');
      expect(pattern).toBe(
        '#tag\\(with\\)parens\\b|tags:.*?\\btag\\(with\\)parens\\b|^\\s*-\\s+tag\\(with\\)parens\\b\\s*$'
      );
    });

    it('escapes square brackets', () => {
      const pattern = generateTagSearchPattern('tag[with]brackets');
      expect(pattern).toBe(
        '#tag\\[with\\]brackets\\b|tags:.*?\\btag\\[with\\]brackets\\b|^\\s*-\\s+tag\\[with\\]brackets\\b\\s*$'
      );
    });

    it('escapes curly braces', () => {
      const pattern = generateTagSearchPattern('tag{with}braces');
      expect(pattern).toBe(
        '#tag\\{with\\}braces\\b|tags:.*?\\btag\\{with\\}braces\\b|^\\s*-\\s+tag\\{with\\}braces\\b\\s*$'
      );
    });

    it('escapes question marks', () => {
      const pattern = generateTagSearchPattern('tag?');
      expect(pattern).toBe(
        '#tag\\?\\b|tags:.*?\\btag\\?\\b|^\\s*-\\s+tag\\?\\b\\s*$'
      );
    });

    it('escapes dollar signs', () => {
      const pattern = generateTagSearchPattern('tag$');
      expect(pattern).toBe(
        '#tag\\$\\b|tags:.*?\\btag\\$\\b|^\\s*-\\s+tag\\$\\b\\s*$'
      );
    });

    it('escapes caret', () => {
      const pattern = generateTagSearchPattern('^tag');
      expect(pattern).toBe(
        '#\\^tag\\b|tags:.*?\\b\\^tag\\b|^\\s*-\\s+\\^tag\\b\\s*$'
      );
    });

    it('escapes pipe', () => {
      const pattern = generateTagSearchPattern('tag|other');
      expect(pattern).toBe(
        '#tag\\|other\\b|tags:.*?\\btag\\|other\\b|^\\s*-\\s+tag\\|other\\b\\s*$'
      );
    });

    it('escapes backslash', () => {
      const pattern = generateTagSearchPattern('tag\\test');
      expect(pattern).toBe(
        '#tag\\\\test\\b|tags:.*?\\btag\\\\test\\b|^\\s*-\\s+tag\\\\test\\b\\s*$'
      );
    });
  });

  describe('pattern matching verification', () => {
    it('pattern should match inline hashtags', () => {
      const pattern = generateTagSearchPattern('test-tag');
      const regex = new RegExp(pattern);

      expect(regex.test('#test-tag')).toBe(true);
      expect(regex.test('#test-tag in sentence')).toBe(true);
      expect(regex.test('text #test-tag more text')).toBe(true);
    });

    it('pattern should match YAML array format', () => {
      const pattern = generateTagSearchPattern('test-tag');
      const regex = new RegExp(pattern);

      expect(regex.test('tags: [test-tag, other]')).toBe(true);
      expect(regex.test('tags: [test-tag]')).toBe(true);
      expect(regex.test('tags: [other, test-tag]')).toBe(true);
      expect(regex.test('tags: test-tag')).toBe(true);
    });

    it('pattern should match YAML list format with tag right after dash', () => {
      const pattern = generateTagSearchPattern('test-tag');
      const regex = new RegExp(pattern, 'm'); // multiline flag

      expect(regex.test('  - test-tag')).toBe(true);
      expect(regex.test('- test-tag')).toBe(true);
      expect(regex.test('    - test-tag')).toBe(true);
    });

    it('pattern should NOT match markdown lists with tag not right after dash', () => {
      const pattern = generateTagSearchPattern('test-tag');
      const regex = new RegExp(pattern, 'm');

      // These should NOT match because the tag is not immediately after the dash
      expect(regex.test('- This is a test-tag item')).toBe(false);
      expect(regex.test('- Some text about test-tag')).toBe(false);
      expect(regex.test('  - Another test-tag mention')).toBe(false);
    });

    it('pattern should NOT match list items with tag followed by other text', () => {
      const pattern = generateTagSearchPattern('javascript');
      const regex = new RegExp(pattern, 'm');

      // These should NOT match because there's text after the tag
      expect(regex.test('- javascript is cool')).toBe(false);
      expect(regex.test('  - javascript programming')).toBe(false);
      expect(regex.test('- javascript: the language')).toBe(false);
    });

    it('pattern should not match partial words', () => {
      const pattern = generateTagSearchPattern('test');
      const regex = new RegExp(pattern);

      expect(regex.test('#testing')).toBe(false);
      expect(regex.test('tags: [testing]')).toBe(false);
      expect(regex.test('- testing')).toBe(false);
    });

    it('pattern should match hierarchical tags', () => {
      const pattern = generateTagSearchPattern('project/alpha');
      const regex = new RegExp(pattern, 'm');

      expect(regex.test('#project/alpha')).toBe(true);
      expect(regex.test('tags: [project/alpha]')).toBe(true);
      expect(regex.test('  - project/alpha')).toBe(true);
    });

    it('pattern should match tags with spaces after dash', () => {
      const pattern = generateTagSearchPattern('my-tag');
      const regex = new RegExp(pattern, 'm');

      // Multiple spaces after dash should still match
      expect(regex.test('  -   my-tag')).toBe(true);
      expect(regex.test('-  my-tag')).toBe(true);
    });

    it('pattern should handle real-world YAML examples', () => {
      const pattern = generateTagSearchPattern('javascript');
      const regex = new RegExp(pattern, 'm');

      // YAML front matter examples - should match
      const yamlArray = 'tags: [javascript, typescript, react]';
      const yamlList = '  - javascript';
      const yamlListWithTrailingSpace = '  - javascript  ';
      const yamlSingle = 'tags: javascript';
      const inline = 'Learn #javascript today';

      expect(regex.test(yamlArray)).toBe(true);
      expect(regex.test(yamlList)).toBe(true);
      expect(regex.test(yamlListWithTrailingSpace)).toBe(true);
      expect(regex.test(yamlSingle)).toBe(true);
      expect(regex.test(inline)).toBe(true);

      // False positives - should NOT match
      const falsePositive1 = '- Learn javascript programming';
      const falsePositive2 = '- javascript is cool';
      const falsePositive3 = '  - javascript tutorial';

      expect(regex.test(falsePositive1)).toBe(false);
      expect(regex.test(falsePositive2)).toBe(false);
      expect(regex.test(falsePositive3)).toBe(false);
    });
  });
});
