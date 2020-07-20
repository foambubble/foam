import { writeFileToDisk } from '../src/utils/write-file-to-disk';
import * as fs from 'fs';
import mockFS from 'mock-fs';

describe('writeFileToDisk', () => {
  const fileUri = './test-file.md';

  beforeAll(() => {
    mockFS({ [fileUri]: 'content in the existing file' });
  });

  afterAll(() => {
    fs.unlinkSync(fileUri);
    mockFS.restore();
  });

  it('should overrwrite existing file in the disk with the new data', async () => {
    const expected = `content in the new file`;
    await writeFileToDisk(fileUri, expected);
    const actual = await fs.promises.readFile(fileUri, { encoding: 'utf8' });
    expect(actual).toBe(expected);
  });
});
