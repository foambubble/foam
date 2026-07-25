import { Range } from './range';

describe('Range', () => {
  describe('compareTo', () => {
    it('returns a negative number when a starts on an earlier line than b', () => {
      const a = Range.create(1, 0, 1, 10);
      const b = Range.create(2, 0, 2, 10);
      expect(Range.compareTo(a, b)).toBeLessThan(0);
    });

    it('returns a negative number when a starts earlier on the same line as b', () => {
      const a = Range.create(1, 2, 1, 10);
      const b = Range.create(1, 5, 1, 10);
      expect(Range.compareTo(a, b)).toBeLessThan(0);
    });

    it('returns a positive number when a starts after b', () => {
      const a = Range.create(3, 0);
      const b = Range.create(2, 5);
      expect(Range.compareTo(a, b)).toBeGreaterThan(0);
    });

    it('returns zero when the ranges start at the same position', () => {
      const a = Range.create(1, 2, 1, 10);
      const b = Range.create(1, 2, 5, 0);
      expect(Range.compareTo(a, b)).toEqual(0);
    });

    it('sorts ranges by start position when used as a sort comparator', () => {
      const first = Range.create(0, 5);
      const second = Range.create(1, 0);
      const third = Range.create(1, 8);
      const fourth = Range.create(4, 2);

      const sorted = [third, first, fourth, second].sort(Range.compareTo);

      expect(sorted).toEqual([first, second, third, fourth]);
    });
  });

  describe('isBefore', () => {
    it('returns true when a starts before b', () => {
      const a = Range.create(1, 0);
      const b = Range.create(2, 0);
      expect(Range.isBefore(a, b)).toBe(true);
    });

    it('returns false when a starts after b', () => {
      const a = Range.create(2, 5);
      const b = Range.create(2, 1);
      expect(Range.isBefore(a, b)).toBe(false);
    });

    it('returns false when the ranges start at the same position', () => {
      const a = Range.create(1, 2);
      const b = Range.create(1, 2);
      expect(Range.isBefore(a, b)).toBe(false);
    });
  });
});
