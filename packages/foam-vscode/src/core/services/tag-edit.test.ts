import { createTestNote, createTestWorkspace } from '../../test/test-utils';
import { FoamTags } from '../model/tags';
import { TagEdit } from './tag-edit';
import { Range } from '../model/range';
import { Position } from '../model/position';
import { URI } from '../model/uri';

describe('TagEdit', () => {
  describe('createRenameTagEdits', () => {
    it('should generate edits for all occurrences of a tag', () => {
      const ws = createTestWorkspace();

      const pageA = createTestNote({
        uri: '/page-a.md',
        title: 'Page A',
        tags: ['oldtag', 'anothertag'],
      });

      // Manually set the ranges for testing
      pageA.tags[0].range = Range.create(0, 5, 0, 11);
      pageA.tags[1].range = Range.create(1, 5, 1, 15);

      const pageB = createTestNote({
        uri: '/page-b.md',
        title: 'Page B',
        tags: ['oldtag'],
      });

      // Manually set the range for testing
      pageB.tags[0].range = Range.create(2, 10, 2, 16);

      ws.set(pageA);
      ws.set(pageB);

      const foamTags = FoamTags.fromWorkspace(ws);
      const result = TagEdit.createRenameTagEdits(foamTags, 'oldtag', 'newtag');

      expect(result.totalOccurrences).toBe(2);
      expect(result.edits).toHaveLength(2);

      // Check edits - should contain one edit for each page
      const pageAEdit = result.edits.find(
        e => e.uri.toString() === 'file:///page-a.md'
      );
      expect(pageAEdit).toBeDefined();
      expect(pageAEdit!.edit).toEqual({
        range: Range.create(0, 5, 0, 11),
        newText: 'newtag',
      });

      const pageBEdit = result.edits.find(
        e => e.uri.toString() === 'file:///page-b.md'
      );
      expect(pageBEdit).toBeDefined();
      expect(pageBEdit!.edit).toEqual({
        range: Range.create(2, 10, 2, 16),
        newText: 'newtag',
      });
    });

    it('should return empty result when tag does not exist', () => {
      const ws = createTestWorkspace();
      const foamTags = FoamTags.fromWorkspace(ws);

      const result = TagEdit.createRenameTagEdits(
        foamTags,
        'nonexistent',
        'newtag'
      );

      expect(result.totalOccurrences).toBe(0);
      expect(result.edits).toHaveLength(0);
    });

    it('should handle multiple edits in the same file', () => {
      const ws = createTestWorkspace();

      const page = createTestNote({
        uri: '/page.md',
        title: 'Page',
        tags: ['duplicatetag', 'duplicatetag'],
      });

      // Manually set the ranges for testing
      page.tags[0].range = Range.create(0, 5, 0, 17);
      page.tags[1].range = Range.create(5, 10, 5, 22);

      ws.set(page);

      const foamTags = FoamTags.fromWorkspace(ws);
      const result = TagEdit.createRenameTagEdits(
        foamTags,
        'duplicatetag',
        'newtag'
      );

      expect(result.totalOccurrences).toBe(2);
      expect(result.edits).toHaveLength(2);

      // Filter edits for the specific page
      const pageEdits = result.edits.filter(
        e => e.uri.toString() === 'file:///page.md'
      );
      expect(pageEdits).toHaveLength(2);
      expect(pageEdits.map(e => e.edit)).toEqual([
        {
          range: Range.create(0, 5, 0, 17),
          newText: 'newtag',
        },
        {
          range: Range.create(5, 10, 5, 22),
          newText: 'newtag',
        },
      ]);
    });

    it('should preserve # prefix for hashtag-style tags', () => {
      const ws = createTestWorkspace();

      const page = createTestNote({
        uri: '/page.md',
        title: 'Page',
        tags: ['hashtag'],
      });

      // Simulate a hashtag range that includes the # prefix (length = label + 1)
      page.tags[0].range = Range.create(0, 5, 0, 13); // "#hashtag" = 8 chars

      ws.set(page);

      const foamTags = FoamTags.fromWorkspace(ws);
      const result = TagEdit.createRenameTagEdits(
        foamTags,
        'hashtag',
        'newtag'
      );

      expect(result.totalOccurrences).toBe(1);
      expect(result.edits).toHaveLength(1);

      const pageEdit = result.edits[0];
      expect(pageEdit.uri.toString()).toBe('file:///page.md');
      expect(pageEdit.edit).toEqual({
        range: Range.create(0, 5, 0, 13),
        newText: '#newtag', // Should include # prefix
      });
    });

    it('should not add # prefix for YAML-style tags', () => {
      const ws = createTestWorkspace();

      const page = createTestNote({
        uri: '/page.md',
        title: 'Page',
        tags: ['yamltag'],
      });

      // Simulate a YAML tag range that does not include # prefix (length = label only)
      page.tags[0].range = Range.create(0, 5, 0, 12); // "yamltag" = 7 chars

      ws.set(page);

      const foamTags = FoamTags.fromWorkspace(ws);
      const result = TagEdit.createRenameTagEdits(
        foamTags,
        'yamltag',
        'newtag'
      );

      expect(result.totalOccurrences).toBe(1);
      expect(result.edits).toHaveLength(1);

      const pageEdit = result.edits[0];
      expect(pageEdit.uri.toString()).toBe('file:///page.md');
      expect(pageEdit.edit).toEqual({
        range: Range.create(0, 5, 0, 12),
        newText: 'newtag', // Should not include # prefix
      });
    });
  });

  describe('validateTagRename', () => {
    it('should accept valid tag rename', () => {
      const ws = createTestWorkspace();

      const page = createTestNote({
        uri: '/page.md',
        title: 'Page',
        tags: ['oldtag'],
      });

      ws.set(page);

      const foamTags = FoamTags.fromWorkspace(ws);
      const result = TagEdit.validateTagRename(foamTags, 'oldtag', 'newtag');

      expect(result.isValid).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it('should reject rename of non-existent tag', () => {
      const ws = createTestWorkspace();
      const foamTags = FoamTags.fromWorkspace(ws);

      const result = TagEdit.validateTagRename(
        foamTags,
        'nonexistent',
        'newtag'
      );

      expect(result.isValid).toBe(false);
      expect(result.message).toContain('does not exist');
    });

    it('should reject empty new tag name', () => {
      const ws = createTestWorkspace();

      const page = createTestNote({
        uri: '/page.md',
        title: 'Page',
        tags: ['oldtag'],
      });

      ws.set(page);

      const foamTags = FoamTags.fromWorkspace(ws);
      const result = TagEdit.validateTagRename(foamTags, 'oldtag', '');

      expect(result.isValid).toBe(false);
      expect(result.message).toContain('cannot be empty');
    });

    it('should reject rename to existing tag', () => {
      const ws = createTestWorkspace();

      const page = createTestNote({
        uri: '/page.md',
        title: 'Page',
        tags: ['oldtag', 'existingtag'],
      });

      ws.set(page);

      const foamTags = FoamTags.fromWorkspace(ws);
      const result = TagEdit.validateTagRename(
        foamTags,
        'oldtag',
        'existingtag'
      );

      expect(result.isValid).toBe(false);
      expect(result.message).toContain('already exists');
    });

    it('should reject tag names with spaces', () => {
      const ws = createTestWorkspace();

      const page = createTestNote({
        uri: '/page.md',
        title: 'Page',
        tags: ['oldtag'],
      });

      ws.set(page);

      const foamTags = FoamTags.fromWorkspace(ws);
      const result = TagEdit.validateTagRename(foamTags, 'oldtag', 'new tag');

      expect(result.isValid).toBe(false);
      expect(result.message).toContain('cannot contain spaces');
    });

    it('should handle new tag name with # prefix', () => {
      const ws = createTestWorkspace();

      const page = createTestNote({
        uri: '/page.md',
        title: 'Page',
        tags: ['oldtag'],
      });

      ws.set(page);

      const foamTags = FoamTags.fromWorkspace(ws);
      const result = TagEdit.validateTagRename(foamTags, 'oldtag', '#newtag');

      expect(result.isValid).toBe(true);
      expect(result.message).toBeUndefined();
    });
  });

  describe('getTagAtPosition', () => {
    it('should find tag at exact position', () => {
      const ws = createTestWorkspace();

      const page = createTestNote({
        uri: '/page.md',
        title: 'Page',
        tags: ['testtag'],
      });

      // Manually set the range for testing
      page.tags[0].range = Range.create(0, 5, 0, 12);

      ws.set(page);

      const foamTags = FoamTags.fromWorkspace(ws);

      // Test positions within the tag range
      const pageUri = URI.parse('file:///page.md', 'file');
      expect(
        TagEdit.getTagAtPosition(foamTags, pageUri, Position.create(0, 5))
      ).toBe('testtag');
      expect(
        TagEdit.getTagAtPosition(foamTags, pageUri, Position.create(0, 8))
      ).toBe('testtag');
      expect(
        TagEdit.getTagAtPosition(foamTags, pageUri, Position.create(0, 12))
      ).toBe('testtag');

      // Test positions outside the tag range
      expect(
        TagEdit.getTagAtPosition(foamTags, pageUri, Position.create(0, 4))
      ).toBeUndefined();
      expect(
        TagEdit.getTagAtPosition(foamTags, pageUri, Position.create(0, 13))
      ).toBeUndefined();
      expect(
        TagEdit.getTagAtPosition(foamTags, pageUri, Position.create(1, 5))
      ).toBeUndefined();
    });

    it('should return undefined for non-existent file', () => {
      const ws = createTestWorkspace();
      const foamTags = FoamTags.fromWorkspace(ws);

      const nonexistentUri = URI.parse('file:///nonexistent.md', 'file');
      expect(
        TagEdit.getTagAtPosition(
          foamTags,
          nonexistentUri,
          Position.create(0, 5)
        )
      ).toBeUndefined();
    });

    it('should handle multiple tags and return the correct one', () => {
      const ws = createTestWorkspace();

      const page = createTestNote({
        uri: '/page.md',
        title: 'Page',
        tags: ['firsttag', 'secondtag'],
      });

      // Manually set the ranges for testing
      page.tags[0].range = Range.create(0, 5, 0, 13);
      page.tags[1].range = Range.create(0, 20, 0, 29);

      ws.set(page);

      const foamTags = FoamTags.fromWorkspace(ws);

      // Should return the correct tag for each position
      const pageUri = URI.parse('file:///page.md', 'file');
      expect(
        TagEdit.getTagAtPosition(foamTags, pageUri, Position.create(0, 8))
      ).toBe('firsttag');
      expect(
        TagEdit.getTagAtPosition(foamTags, pageUri, Position.create(0, 25))
      ).toBe('secondtag');

      // Position between tags should return undefined
      expect(
        TagEdit.getTagAtPosition(foamTags, pageUri, Position.create(0, 15))
      ).toBeUndefined();
    });

    it('should handle multiline tags', () => {
      const ws = createTestWorkspace();

      const page = createTestNote({
        uri: '/page.md',
        title: 'Page',
        tags: ['multilinetag'],
      });

      // Manually set the range for testing
      page.tags[0].range = Range.create(1, 10, 3, 5);

      ws.set(page);

      const foamTags = FoamTags.fromWorkspace(ws);

      // Should find tag on different lines within the range
      const pageUri = URI.parse('file:///page.md', 'file');
      expect(
        TagEdit.getTagAtPosition(foamTags, pageUri, Position.create(1, 15))
      ).toBe('multilinetag');
      expect(
        TagEdit.getTagAtPosition(foamTags, pageUri, Position.create(2, 0))
      ).toBe('multilinetag');
      expect(
        TagEdit.getTagAtPosition(foamTags, pageUri, Position.create(3, 3))
      ).toBe('multilinetag');

      // Should not find tag outside the range
      expect(
        TagEdit.getTagAtPosition(foamTags, pageUri, Position.create(1, 5))
      ).toBeUndefined();
      expect(
        TagEdit.getTagAtPosition(foamTags, pageUri, Position.create(3, 10))
      ).toBeUndefined();
    });
  });
});
