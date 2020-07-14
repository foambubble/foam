
import { writeFileToDisk } from '../src/utils/write-file-to-disk'
import * as fs from 'fs';
import * as path from 'path';

// TODO: Mock fs
describe('writeFileToDisk', () => {
  const fileUri = path.join(__dirname, 'test-file.md');

  afterAll(() => {
    fs.unlinkSync(fileUri);
  })

  it('should overrwrite existing file in the disk with the new data', async () => {
    const existingData = `content in the existing file`;
    const newData = `content in the new file`;
    fs.writeFileSync(fileUri, existingData);
    await writeFileToDisk(fileUri, newData);
    const actual = fs.readFileSync(fileUri, { encoding: 'utf8' });
    expect(actual).toBe(newData);
  });
})