import { Logger } from '../src/utils/log';
import { URI } from '../src/model/uri';
import { FileDataStore, Matcher } from '../src';
import { toMatcherPathFormat } from '../src/services/datastore';

Logger.setLevel('error');

const testFolder = URI.joinPath(URI.file(__dirname), 'test-datastore');

describe('Matcher', () => {
  it('generates globs with the base dir provided', () => {
    const matcher = new Matcher([testFolder], ['*'], []);
    expect(matcher.folders).toEqual([toMatcherPathFormat(testFolder)]);
    expect(matcher.include).toEqual([
      toMatcherPathFormat(URI.joinPath(testFolder, '*')),
    ]);
  });

  it('defaults to including everything and excluding nothing', () => {
    const matcher = new Matcher([testFolder]);
    expect(matcher.exclude).toEqual([]);
    expect(matcher.include).toEqual([
      toMatcherPathFormat(URI.joinPath(testFolder, '**', '*')),
    ]);
  });

  it('supports multiple includes', () => {
    const matcher = new Matcher([testFolder], ['g1', 'g2'], []);
    expect(matcher.exclude).toEqual([]);
    expect(matcher.include).toEqual([
      toMatcherPathFormat(URI.joinPath(testFolder, 'g1')),
      toMatcherPathFormat(URI.joinPath(testFolder, 'g2')),
    ]);
  });

  it('has a match method to filter strings', () => {
    const matcher = new Matcher([testFolder], ['*.md'], []);
    const files = [
      URI.joinPath(testFolder, 'file1.md'),
      URI.joinPath(testFolder, 'file2.md'),
      URI.joinPath(testFolder, 'file3.mdx'),
      URI.joinPath(testFolder, 'sub', 'file4.md'),
    ];
    expect(matcher.match(files)).toEqual([
      URI.joinPath(testFolder, 'file1.md'),
      URI.joinPath(testFolder, 'file2.md'),
    ]);
  });

  it('has a isMatch method to see whether a file is matched or not', () => {
    const matcher = new Matcher([testFolder], ['*.md'], []);
    const files = [
      URI.joinPath(testFolder, 'file1.md'),
      URI.joinPath(testFolder, 'file2.md'),
      URI.joinPath(testFolder, 'file3.mdx'),
      URI.joinPath(testFolder, 'sub', 'file4.md'),
    ];
    expect(matcher.isMatch(files[0])).toEqual(true);
    expect(matcher.isMatch(files[1])).toEqual(true);
    expect(matcher.isMatch(files[2])).toEqual(false);
    expect(matcher.isMatch(files[3])).toEqual(false);
  });

  it('ignores files in the exclude list', () => {
    const matcher = new Matcher([testFolder], ['*.md'], ['file1.*']);
    const files = [
      URI.joinPath(testFolder, 'file1.md'),
      URI.joinPath(testFolder, 'file2.md'),
      URI.joinPath(testFolder, 'file3.mdx'),
      URI.joinPath(testFolder, 'sub', 'file4.md'),
    ];
    expect(matcher.isMatch(files[0])).toEqual(false);
    expect(matcher.isMatch(files[1])).toEqual(true);
    expect(matcher.isMatch(files[2])).toEqual(false);
    expect(matcher.isMatch(files[3])).toEqual(false);
  });
});

describe('Datastore', () => {
  it('uses the matcher to get the file list', async () => {
    const matcher = new Matcher([testFolder], ['**/*.md'], []);
    const ds = new FileDataStore();
    expect((await ds.list(matcher.include[0])).length).toEqual(4);
  });
});
