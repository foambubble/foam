import { pluralize } from './string';

describe('String Utilities', () => {
  describe('pluralize', () => {
    it('should return singular form for count of 1', () => {
      expect(pluralize(1, 'file')).toBe('1 file');
      expect(pluralize(1, 'link')).toBe('1 link');
      expect(pluralize(1, 'error')).toBe('1 error');
    });

    it('should return plural form for count of 0', () => {
      expect(pluralize(0, 'file')).toBe('0 files');
      expect(pluralize(0, 'link')).toBe('0 links');
      expect(pluralize(0, 'error')).toBe('0 errors');
    });

    it('should return plural form for count greater than 1', () => {
      expect(pluralize(2, 'file')).toBe('2 files');
      expect(pluralize(5, 'link')).toBe('5 links');
      expect(pluralize(10, 'error')).toBe('10 errors');
    });

    it('should use custom plural form when provided', () => {
      expect(pluralize(0, 'child', 'children')).toBe('0 children');
      expect(pluralize(1, 'child', 'children')).toBe('1 child');
      expect(pluralize(2, 'child', 'children')).toBe('2 children');
      expect(pluralize(5, 'child', 'children')).toBe('5 children');
    });

    it('should handle irregular plurals correctly', () => {
      expect(pluralize(1, 'person', 'people')).toBe('1 person');
      expect(pluralize(2, 'person', 'people')).toBe('2 people');
      expect(pluralize(1, 'goose', 'geese')).toBe('1 goose');
      expect(pluralize(3, 'goose', 'geese')).toBe('3 geese');
    });

    it('should handle words ending in s correctly', () => {
      expect(pluralize(1, 'analysis', 'analyses')).toBe('1 analysis');
      expect(pluralize(2, 'analysis', 'analyses')).toBe('2 analyses');
    });
  });
});
