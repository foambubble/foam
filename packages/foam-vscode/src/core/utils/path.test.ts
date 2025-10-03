import { asAbsolutePaths, fromFsPath } from './path';

describe('path utils', () => {
  describe('fromFsPath', () => {
    it('should normalize backslashes in relative paths', () => {
      const [path] = fromFsPath('areas\\dailies\\2024\\file.md');
      expect(path).toBe('areas/dailies/2024/file.md');
    });

    it('should handle mixed separators in relative paths', () => {
      const [path] = fromFsPath('areas/dailies\\2024/file.md');
      expect(path).toBe('areas/dailies/2024/file.md');
    });

    it('should preserve forward slashes in relative paths', () => {
      const [path] = fromFsPath('areas/dailies/2024/file.md');
      expect(path).toBe('areas/dailies/2024/file.md');
    });

    it('should normalize backslashes in Windows absolute paths', () => {
      const [path] = fromFsPath('C:\\workspace\\file.md');
      expect(path).toBe('/C:/workspace/file.md');
    });
  });

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
