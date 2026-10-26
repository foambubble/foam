import { describe, expect, it } from 'vitest';
import { LoadProfiler } from './load-profiler';
import { URI } from '../model/uri';
import { InMemoryDataStore } from '../../test/test-utils';

const sample = (path: string, ms: number, chars = 100, cacheHit = false) => ({
  uri: URI.file(path),
  chars,
  ms,
  cacheHit,
});

/**
 * Reads through `profiler`'s instrumented data store that settle only when the
 * test says so, to lay them out on the profiler's clock.
 */
const deferredReads = (profiler: LoadProfiler) => {
  const pending = new Map<
    string,
    { resolve: (content: string) => void; reject: (error: Error) => void }
  >();
  const dataStore = new InMemoryDataStore();
  dataStore.read = uri =>
    new Promise((resolve, reject) =>
      pending.set(uri.path, { resolve, reject })
    );
  const instrumented = profiler.instrumentDataStore(dataStore);
  return {
    start: (path: string) => instrumented.read(URI.file(path)),
    settle: (path: string, content: string) =>
      pending.get(path).resolve(content),
    fail: (path: string, error: Error) => pending.get(path).reject(error),
  };
};

describe('LoadProfiler', () => {
  it('reports zero wall clock before it is started', () => {
    expect(new LoadProfiler().wallMs).toEqual(0);
  });

  it('ignores samples taken before it is started', async () => {
    const profiler = new LoadProfiler();
    const dataStore = new InMemoryDataStore();
    dataStore.set(URI.file('/a.md'), 'content');
    await profiler.instrumentDataStore(dataStore).read(URI.file('/a.md'));
    profiler.recordParse(sample('/a.md', 10));

    expect(profiler.getStats().read.count).toEqual(0);
    expect(profiler.getStats().parse.count).toEqual(0);
  });

  it('stops recording once stopped, so the load report is not diluted by later edits', () => {
    const profiler = new LoadProfiler();
    profiler.start();
    profiler.recordParse(sample('/a.md', 10));
    profiler.stop();

    // every keystroke re-parses the open note through the same instrumented
    // parser for the rest of the session
    for (let i = 0; i < 100; i++) {
      profiler.recordParse(sample('/a.md', 1800));
    }

    const { parse, slowest } = profiler.getStats();
    expect(parse.count).toEqual(1);
    expect(slowest).toHaveLength(1);
  });

  it('aggregates read cost across files', async () => {
    let t = 0;
    const profiler = new LoadProfiler(() => t);
    const reads = deferredReads(profiler);
    profiler.start();
    for (const [path, ms, bytes] of [
      ['/a.md', 10, 1000],
      ['/b.md', 30, 2000],
      ['/c.md', 5, 500],
    ] as const) {
      const read = reads.start(path);
      t += ms;
      reads.settle(path, 'x'.repeat(bytes));
      await read;
    }

    const { read } = profiler.getStats();
    expect(read.count).toEqual(3);
    expect(read.totalMs).toEqual(45);
    expect(read.maxMs).toEqual(30);
    expect(read.totalBytes).toEqual(3500);
  });

  it('counts only the part of a read that falls between start and stop', async () => {
    let t = 0;
    const profiler = new LoadProfiler(() => t);
    const reads = deferredReads(profiler);

    const read = reads.start('/a.md');
    t = 10;
    profiler.start();
    t = 50;
    profiler.stop();
    t = 80;
    reads.settle('/a.md', 'a');
    await read;

    expect(profiler.getStats().read.totalMs).toEqual(40);
  });

  it('keeps accounting for reads after one rejects', async () => {
    let t = 0;
    const profiler = new LoadProfiler(() => t);
    const reads = deferredReads(profiler);
    profiler.start();

    const a = reads.start('/a.md');
    t = 10;
    reads.fail('/a.md', new Error('EIO'));
    await expect(a).rejects.toThrow('EIO');
    t = 20;
    const b = reads.start('/b.md');
    t = 30;
    reads.settle('/b.md', 'b');
    await b;
    t = 100;
    profiler.stop();

    expect(profiler.getStats().read.totalMs).toEqual(20);
  });

  it('counts cache hits and misses separately', () => {
    const profiler = new LoadProfiler();
    profiler.start();
    profiler.recordParse(sample('/a.md', 1, 100, true));
    profiler.recordParse(sample('/b.md', 20, 100, false));
    profiler.recordParse(sample('/c.md', 1, 100, true));

    const { cache, parse } = profiler.getStats();
    expect(cache).toEqual({ hits: 2, misses: 1 });
    expect(parse.count).toEqual(3);
    expect(parse.totalMs).toEqual(22);
  });

  it('keeps the slowest parses in descending order', () => {
    const profiler = new LoadProfiler();
    profiler.start();
    [5, 100, 20, 3, 60].forEach((ms, i) =>
      profiler.recordParse(sample(`/note-${i}.md`, ms))
    );

    const { slowest, parse } = profiler.getStats();
    expect(slowest.map(s => s.ms)).toEqual([100, 60, 20, 5, 3]);
    expect(parse.maxMs).toEqual(100);
  });

  it('bounds the slowest list rather than keeping every sample', () => {
    const profiler = new LoadProfiler();
    profiler.start();
    for (let i = 0; i < 500; i++) {
      profiler.recordParse(sample(`/note-${i}.md`, i));
    }

    const { slowest, parse } = profiler.getStats();
    expect(slowest).toHaveLength(10);
    expect(slowest[0].ms).toEqual(499);
    expect(slowest[9].ms).toEqual(490);
    // aggregates still cover every sample
    expect(parse.count).toEqual(500);
  });

  it('measures the cost of reads made through the instrumented data store', async () => {
    const dataStore = new InMemoryDataStore();
    dataStore.set(URI.file('/note.md'), 'hello world');
    const profiler = new LoadProfiler();
    profiler.start();

    const instrumented = profiler.instrumentDataStore(dataStore);
    const content = await instrumented.read(URI.file('/note.md'));

    expect(content).toEqual('hello world');
    const { read } = profiler.getStats();
    expect(read.count).toEqual(1);
    expect(read.totalBytes).toEqual('hello world'.length);
  });

  it('does not count bytes for a file that could not be read', async () => {
    const profiler = new LoadProfiler();
    profiler.start();
    const instrumented = profiler.instrumentDataStore(new InMemoryDataStore());

    expect(await instrumented.read(URI.file('/missing.md'))).toBeNull();
    const { read } = profiler.getStats();
    expect(read.count).toEqual(1);
    expect(read.totalBytes).toEqual(0);
  });

  it('delegates the other data store operations untouched', async () => {
    const dataStore = new InMemoryDataStore();
    const profiler = new LoadProfiler();
    profiler.start();
    const instrumented = profiler.instrumentDataStore(dataStore);

    await instrumented.write(URI.file('/a.md'), 'content');
    expect(await instrumented.exists(URI.file('/a.md'))).toBeTruthy();
    expect(await instrumented.list()).toEqual([URI.file('/a.md')]);

    await instrumented.move(URI.file('/a.md'), URI.file('/b.md'));
    expect(await instrumented.exists(URI.file('/a.md'))).toBeFalsy();

    await instrumented.delete(URI.file('/b.md'));
    expect(await instrumented.exists(URI.file('/b.md'))).toBeFalsy();
    // none of the above is a read
    expect(profiler.getStats().read.count).toEqual(0);
  });

  describe('report', () => {
    it('attributes the wall clock that is neither read nor parse', () => {
      const profiler = new LoadProfiler();
      profiler.start();
      profiler.recordParse(sample('/note.md', 200));
      profiler.stop();

      const report = profiler.formatReport();
      expect(report).toMatch(/unaccounted:/);
      // the fake sample is longer than the whole wall clock, so the remainder
      // is clamped rather than reported as negative
      expect(report).not.toMatch(/-\d+ ms/);
    });

    it('splits the wall clock between reading, parsing and neither when reads overlap (#1689)', async () => {
      let t = 0;
      const profiler = new LoadProfiler(() => t);
      const reads = deferredReads(profiler);
      profiler.start();

      const a = reads.start('/a.md');
      const b = reads.start('/b.md');
      // a parse from 50 to 80, while both reads are in flight
      t = 80;
      profiler.recordParse(sample('/c.md', 30));
      t = 100;
      reads.settle('/a.md', 'a');
      await a;
      t = 150;
      reads.settle('/b.md', 'b');
      await b;
      t = 200;
      profiler.stop();

      const report = profiler.formatReport();
      expect(report).toMatch(/wall clock:\s+200 ms/);
      expect(report).toMatch(
        /file read:\s+120 ms \(60%\) over 2 files, .*, slowest 150 ms/
      );
      expect(report).toMatch(/markdown parse:\s+30 ms \(15%\)/);
      expect(report).toMatch(/unaccounted:\s+50 ms \(25%\)/);
    });

    it('lists the slowest notes by path', () => {
      const profiler = new LoadProfiler();
      profiler.start();
      profiler.recordParse(sample('/small.md', 1));
      profiler.recordParse(sample('/journal/huge.md', 5000));

      const report = profiler.formatReport();
      expect(report).toMatch(/slowest notes to parse:/);
      expect(report).toMatch(/\/journal\/huge\.md/);
    });

    it('calls out when a single note dominates the parse time', () => {
      const profiler = new LoadProfiler();
      profiler.start();
      profiler.recordParse(sample('/journal/huge.md', 900));
      profiler.recordParse(sample('/small.md', 100));

      expect(profiler.formatReport()).toMatch(
        /90% of all parse time is a single note/
      );
    });

    it('does not call out a single note when the cost is spread out', () => {
      const profiler = new LoadProfiler();
      profiler.start();
      for (let i = 0; i < 20; i++) {
        profiler.recordParse(sample(`/note-${i}.md`, 100));
      }

      expect(profiler.formatReport()).not.toMatch(/of all parse time/);
    });

    it('includes the host measurements it is given', () => {
      const report = new LoadProfiler().formatReport({
        'event loop': 'max 40000 ms',
        memory: 'heapUsed 900 MiB',
      });

      expect(report).toMatch(/event loop:\s+max 40000 ms/);
      expect(report).toMatch(/memory:\s+heapUsed 900 MiB/);
    });
  });
});
