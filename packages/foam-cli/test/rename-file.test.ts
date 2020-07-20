import { renameFile } from '../src/utils/rename-file';
import * as fs from 'fs';
import mockFS from 'mock-fs';

const doesFileExist = path =>
  fs.promises
    .access(path)
    .then(() => true)
    .catch(() => false);

describe('renameFile', () => {
  const fileUri = './test/oldFileName.md';

  beforeAll(() => {
    mockFS({ [fileUri]: '' });
  });

  afterAll(() => {
    mockFS.restore();
  });

  it('should rename existing file', async () => {
    expect(await doesFileExist(fileUri)).toBe(true);

    renameFile(fileUri, 'new-file-name');

    expect(await doesFileExist(fileUri)).toBe(false);
    expect(await doesFileExist('./test/new-file-name.md')).toBe(true);
  });
});
