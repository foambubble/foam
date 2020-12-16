import { createConfigFromObject } from '../src/config';
import { Logger } from '../src/utils/log';
import { URI } from '../src/common/uri';
import { FileDataStore } from '../src';

Logger.setLevel('error');

const testFolder = URI.joinPath(URI.file(__dirname), 'test-datastore');

function makeConfig(params: { include: string[]; ignore: string[] }) {
  return createConfigFromObject(
    [testFolder],
    params.include,
    params.ignore,
    {}
  );
}

describe('Datastore', () => {
  it('defaults to including nothing and exclude nothing', async () => {
    const ds = new FileDataStore(
      makeConfig({
        include: [],
        ignore: [],
      })
    );
    expect(await ds.listFiles()).toHaveLength(0);
  });

  it('returns only markdown files', async () => {
    const ds = new FileDataStore(
      makeConfig({
        include: ['**/*'],
        ignore: [],
      })
    );
    const res = toStringSet(await ds.listFiles());
    expect(res).toEqual(
      makeAbsolute([
        '/file-a.md',
        '/info/file-b.md',
        '/docs/file-in-nm.md',
        '/info/docs/file-in-sub-nm.md',
      ])
    );
  });

  it('supports excludes', async () => {
    const ds = new FileDataStore(
      makeConfig({
        include: ['**/*'],
        ignore: ['**/docs/**'],
      })
    );
    const res = toStringSet(await ds.listFiles());
    expect(res).toEqual(makeAbsolute(['/file-a.md', '/info/file-b.md']));
  });
});

function toStringSet(uris: URI[]) {
  return new Set(uris.map(uri => uri.path.toLocaleLowerCase()));
}

function makeAbsolute(files: string[]) {
  return new Set(
    files.map(f =>
      URI.joinPath(testFolder, f)
        .path.toLocaleLowerCase()
        .replace(/\\/g, '/')
    )
  );
}
