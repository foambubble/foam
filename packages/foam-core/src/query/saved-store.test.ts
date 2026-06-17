import { describe, expect, it } from 'vitest';
import micromatch from 'micromatch';
import { InMemoryDataStore } from '../../test/test-utils';
import { URI } from '../model/uri';
import {
  QueryStore,
  QUERIES_DIR,
  createQueryDataStore,
} from './saved-store';

const ROOT = URI.file('/workspace');

function makeStore() {
  const dataStore = new InMemoryDataStore();
  const queryStore = new QueryStore(dataStore, ROOT);
  return { dataStore, queryStore };
}

describe('QueryStore', () => {
  describe('getFileUri', () => {
    it('builds .foam/queries/<id>.yaml under the workspace root', () => {
      const { queryStore } = makeStore();
      const uri = queryStore.getFileUri('work-in-progress');
      expect(uri.path).toBe(`${ROOT.path}/${QUERIES_DIR}/work-in-progress.yaml`);
    });
  });

  describe('isQueryFile', () => {
    it('recognises yaml files under .foam/queries/', () => {
      const { queryStore } = makeStore();
      expect(
        queryStore.isQueryFile(
          ROOT.joinPath(QUERIES_DIR, 'wip.yaml')
        )
      ).toBe(true);
      expect(
        queryStore.isQueryFile(ROOT.joinPath(QUERIES_DIR, 'wip.yml'))
      ).toBe(true);
    });

    it('rejects non-yaml files in the directory', () => {
      const { queryStore } = makeStore();
      expect(
        queryStore.isQueryFile(ROOT.joinPath(QUERIES_DIR, 'wip.json'))
      ).toBe(false);
    });

    it('rejects yaml files outside the directory', () => {
      const { queryStore } = makeStore();
      expect(
        queryStore.isQueryFile(ROOT.joinPath('other', 'wip.yaml'))
      ).toBe(false);
    });
  });

  describe('save + load + delete', () => {
    it('round-trips a query through save then load', async () => {
      const { queryStore } = makeStore();
      const uri = await queryStore.save({
        id: 'wip',
        name: 'Wip',
        descriptor: { filter: '#wip' },
      });
      expect(uri.path).toContain(`${QUERIES_DIR}/wip.yaml`);

      const loaded = await queryStore.load(uri);
      expect(loaded.errors).toEqual([]);
      expect(loaded.query.id).toBe('wip');
      expect(loaded.query.descriptor.filter).toBe('#wip');
    });

    it('exists() reports true after save and false after delete', async () => {
      const { queryStore } = makeStore();
      expect(await queryStore.exists('wip')).toBe(false);
      await queryStore.save({
        id: 'wip',
        name: 'Wip',
        descriptor: { filter: '#wip' },
      });
      expect(await queryStore.exists('wip')).toBe(true);
      await queryStore.delete('wip');
      expect(await queryStore.exists('wip')).toBe(false);
    });

    it('delete is a no-op when the file does not exist', async () => {
      const { queryStore } = makeStore();
      await expect(queryStore.delete('never-existed')).resolves.toBeUndefined();
    });

    it('load returns undefined for a missing file', async () => {
      const { queryStore } = makeStore();
      const result = await queryStore.load(
        ROOT.joinPath(QUERIES_DIR, 'absent.yaml')
      );
      expect(result).toBeUndefined();
    });

    it('load returns undefined for a file that fails to parse into a Query', async () => {
      const { dataStore, queryStore } = makeStore();
      const uri = ROOT.joinPath(QUERIES_DIR, 'broken.yaml');
      // Top-level list is not a valid query mapping.
      await dataStore.write(uri, '- one\n- two\n');
      const result = await queryStore.load(uri);
      expect(result).toBeUndefined();
    });

    it('load returns errors alongside a successfully parsed query', async () => {
      const { dataStore, queryStore } = makeStore();
      const uri = ROOT.joinPath(QUERIES_DIR, 'wip.yaml');
      await dataStore.write(uri, 'filter: "#wip"\nbogus: 42\n');
      const result = await queryStore.load(uri);
      expect(result.errors).toEqual(['Unknown field "bogus"']);
      expect(result.query.descriptor.filter).toBe('#wip');
    });
  });

  describe('loadAll', () => {
    it('returns every parseable query in the directory', async () => {
      const { dataStore, queryStore } = makeStore();
      await dataStore.write(
        ROOT.joinPath(QUERIES_DIR, 'wip.yaml'),
        'filter: "#wip"\n'
      );
      await dataStore.write(
        ROOT.joinPath(QUERIES_DIR, 'done.yml'),
        'filter: "#done"\n'
      );

      const queries = await queryStore.loadAll();
      const ids = queries.map(q => q.query.id).sort();
      expect(ids).toEqual(['done', 'wip']);
    });

    it('skips files that fail to parse and keeps the rest', async () => {
      const { dataStore, queryStore } = makeStore();
      await dataStore.write(
        ROOT.joinPath(QUERIES_DIR, 'good.yaml'),
        'filter: "#wip"\n'
      );
      await dataStore.write(
        ROOT.joinPath(QUERIES_DIR, 'broken.yaml'),
        '- not a mapping\n'
      );

      const queries = await queryStore.loadAll();
      expect(queries.map(q => q.query.id)).toEqual(['good']);
    });

    it('returns an empty list when the queries directory has no yaml files', async () => {
      const { dataStore, queryStore } = makeStore();
      // Unrelated file in the workspace — must be ignored.
      await dataStore.write(ROOT.joinPath('readme.md'), '# hi');
      expect(await queryStore.loadAll()).toEqual([]);
    });

    it('ignores non-yaml files that happen to sit under .foam/queries/', async () => {
      const { dataStore, queryStore } = makeStore();
      await dataStore.write(
        ROOT.joinPath(QUERIES_DIR, 'wip.yaml'),
        'filter: "#wip"\n'
      );
      await dataStore.write(
        ROOT.joinPath(QUERIES_DIR, 'notes.txt'),
        'not a query'
      );

      const queries = await queryStore.loadAll();
      expect(queries.map(q => q.query.id)).toEqual(['wip']);
    });

    it('ignores yaml files outside the queries directory', async () => {
      const { dataStore, queryStore } = makeStore();
      await dataStore.write(
        ROOT.joinPath('elsewhere.yaml'),
        'filter: "#wip"\n'
      );
      expect(await queryStore.loadAll()).toEqual([]);
    });
  });
});

describe('createQueryDataStore', () => {
  it('forwards list() calls without a pattern to the queries glob', async () => {
    const seenPatterns: string[] = [];
    const store = createQueryDataStore({
      list: async pattern => {
        seenPatterns.push(pattern);
        return [];
      },
      read: async () => '',
      write: async () => undefined,
      delete: async () => undefined,
      exists: async () => false,
    });

    await store.list();
    expect(seenPatterns).toEqual([`${QUERIES_DIR}/*.{yaml,yml}`]);
  });

  it('passes an explicit pattern through unchanged', async () => {
    const seenPatterns: string[] = [];
    const store = createQueryDataStore({
      list: async pattern => {
        seenPatterns.push(pattern);
        return [];
      },
      read: async () => '',
      write: async () => undefined,
      delete: async () => undefined,
      exists: async () => false,
    });

    await store.list('explicit/glob/*.yaml');
    expect(seenPatterns).toEqual(['explicit/glob/*.yaml']);
  });

  it('powers a QueryStore end-to-end using only IO primitives', async () => {
    const files = new Map<string, string>();
    const store = createQueryDataStore({
      // Workspace-relative pattern → match anywhere under the workspace.
      list: async pattern => {
        const matched = micromatch(Array.from(files.keys()), [`**/${pattern}`]);
        return matched.map(p => URI.parse(p, 'file'));
      },
      read: async uri => files.get(uri.path) ?? '',
      write: async (uri, content) => {
        files.set(uri.path, content);
      },
      delete: async uri => {
        files.delete(uri.path);
      },
      exists: async uri => files.has(uri.path),
    });

    const queryStore = new QueryStore(store, ROOT);
    await queryStore.save({
      id: 'wip',
      name: 'Wip',
      descriptor: { filter: '#wip' },
    });

    const all = await queryStore.loadAll();
    expect(all).toHaveLength(1);
    expect(all[0].query.id).toBe('wip');
  });
});
