
import { renameFile } from '../src/utils/rename-file'
import * as fs from 'fs';
import mockFS from 'mock-fs';

describe('renameFile', () => {

  const fileUri = './test/oldFileName.md';

  beforeAll(() => {
    mockFS({ [fileUri]: '' })
  });

  afterAll(() => {
    mockFS.restore();
  });

  it('should rename existing file', async () => {
    expect(fs.existsSync(fileUri)).toBe(true);
    renameFile(fileUri, 'new-file-name');

    expect(fs.existsSync(fileUri)).toBe(false);
    expect(fs.existsSync('./test/new-file-name.md')).toBe(true);
  });
});