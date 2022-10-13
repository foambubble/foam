import { asAbsolutePaths } from './path';

describe('path utils', () => {
  describe('asAbsolutePaths', () => {
    it('returns the path if already absolute', () => {
      const paths = asAbsolutePaths('/path/to/test', [
        '/root/Users',
        '/root/tmp',
      ]);
      expect(paths).toEqual(['/path/to/test']);
    });
    it('returns the matching base if found', () => {
      const paths = asAbsolutePaths('tmp/to/test', [
        '/root/Users',
        '/root/tmp',
      ]);
      expect(paths).toEqual(['/root/tmp/to/test']);
    });
    it('returns all bases if no match is found', () => {
      const paths = asAbsolutePaths('path/to/test', [
        '/root/Users',
        '/root/tmp',
      ]);
      expect(paths).toEqual([
        '/root/Users/path/to/test',
        '/root/tmp/path/to/test',
      ]);
    });
  });
});
