import { createNoteFromMarkdown } from '../../test/test-utils';
import { Position } from './position';
import { URI } from './uri';
import { Resource, Block } from './note';

describe('Resource', () => {
  describe('getSectionAtPosition', () => {
    it('should return the section when position is on the heading line', () => {
      const note = createNoteFromMarkdown(
        '/page.md',
        `# Introduction

## Methods
`
      );

      const section = Resource.getSectionAtPosition(
        note,
        Position.create(0, 3)
      );
      expect(section?.label).toBe('Introduction');
    });

    it('should return the section when position is in the section body', () => {
      const note = createNoteFromMarkdown(
        '/page.md',
        `# Introduction

Body text here.
`
      );

      const section = Resource.getSectionAtPosition(
        note,
        Position.create(2, 0)
      );
      expect(section?.label).toBe('Introduction');
    });

    it('should return the correct section when cursor is mid-line on the heading', () => {
      const note = createNoteFromMarkdown(
        '/page.md',
        `Some content

Another line

## My Long Heading
`
      );

      // "## My Long Heading" is on line 4
      const section = Resource.getSectionAtPosition(
        note,
        Position.create(4, 10)
      );
      expect(section?.label).toBe('My Long Heading');
    });

    it('should return the correct section among multiple sections', () => {
      const note = createNoteFromMarkdown(
        '/page.md',
        `# Section One

Content one.

## Section Two

Content two.
`
      );

      expect(
        Resource.getSectionAtPosition(note, Position.create(0, 0))?.label
      ).toBe('Section One');
      expect(
        Resource.getSectionAtPosition(note, Position.create(2, 0))?.label
      ).toBe('Section One');
      expect(
        Resource.getSectionAtPosition(note, Position.create(5, 0))?.label
      ).toBe('Section Two');
      expect(
        Resource.getSectionAtPosition(note, Position.create(6, 0))?.label
      ).toBe('Section Two');
    });

    it('should return undefined when there are no sections', () => {
      const note = createNoteFromMarkdown(
        '/page.md',
        `Just some plain content.`
      );

      const section = Resource.getSectionAtPosition(
        note,
        Position.create(0, 0)
      );
      expect(section).toBeUndefined();
    });

    it('should return undefined for a URI that does not exist', () => {
      const note = createNoteFromMarkdown('/page.md', `# Heading\n`);
      const ghost = { ...note, uri: URI.file('/ghost.md') };

      // Position before any section content
      const section = Resource.getSectionAtPosition(
        ghost,
        Position.create(99, 0)
      );
      expect(section).toBeUndefined();
    });
  });
});

describe('Block', () => {
  describe('generateId', () => {
    it('should return a non-empty string', () => {
      expect(Block.generateId().length).toBeGreaterThan(0);
    });

    it('should only contain characters valid in a block anchor ([a-z0-9])', () => {
      for (let i = 0; i < 50; i++) {
        expect(Block.generateId()).toMatch(/^[a-z0-9]+$/);
      }
    });

    it('should return different values on successive calls', () => {
      const ids = new Set(Array.from({ length: 20 }, () => Block.generateId()));
      // Extremely unlikely to collide 20 times in a row
      expect(ids.size).toBeGreaterThan(1);
    });
  });
});
