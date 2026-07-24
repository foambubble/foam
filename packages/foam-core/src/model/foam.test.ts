import { bootstrap } from './foam';
import { Emitter } from '../common/event';
import { URI } from './uri';
import { GenericDataStore, IMatcher, IWatcher } from '../services/datastore';
import { ResourceParser } from './note';
import { ResourceProvider } from './provider';
import { createTestNote } from '../../test/test-utils';

/**
 * A fake watcher whose events can be fired manually from tests, so we can
 * exercise `bootstrap`'s create/change/delete handling without any file I/O.
 */
class FakeWatcher implements IWatcher {
  private onDidChangeEmitter = new Emitter<URI>();
  private onDidCreateEmitter = new Emitter<URI>();
  private onDidDeleteEmitter = new Emitter<URI>();
  onDidChange = this.onDidChangeEmitter.event;
  onDidCreate = this.onDidCreateEmitter.event;
  onDidDelete = this.onDidDeleteEmitter.event;

  fireCreate(uri: URI) {
    this.onDidCreateEmitter.fire(uri);
  }
  fireChange(uri: URI) {
    this.onDidChangeEmitter.fire(uri);
  }
  fireDelete(uri: URI) {
    this.onDidDeleteEmitter.fire(uri);
  }
}

/**
 * A matcher that counts how many times `refresh()` is invoked, so we can assert
 * that a burst of create events does not trigger one full workspace scan each.
 * A uri is considered a match when its path ends with `.md`.
 */
class CountingMatcher implements IMatcher {
  include: string[] = ['**/*'];
  exclude: string[] = [];
  refreshCount = 0;

  match(files: URI[]): URI[] {
    return files.filter(f => this.isMatch(f));
  }
  isMatch(uri: URI): boolean {
    return uri.path.endsWith('.md');
  }
  async refresh(): Promise<void> {
    this.refreshCount += 1;
  }
}

const noopParser: ResourceParser = {
  parse: () => {
    throw new Error('parser should not be called in these tests');
  },
};

/**
 * A provider that turns any matched uri into an empty note, so that
 * `workspace.fetchAndSet` succeeds and we can observe which creates were
 * processed via `workspace.onDidAdd`. It reports no resources at load time.
 */
const notesProvider: ResourceProvider = {
  supports: () => true,
  readAsMarkdown: async () => null,
  fetch: async uri => createTestNote({ uri: uri.path }),
  resolveLink: () => {
    throw new Error('resolveLink should not be called in these tests');
  },
  dispose: () => {},
};

/** Waits for pending debounced timers / microtasks to settle. */
const flush = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** The create-event debounce in bootstrap is 100ms; wait comfortably past it. */
const DEBOUNCE_SETTLE_MS = 300;

async function bootstrapWithWatcher(matcher: IMatcher) {
  const watcher = new FakeWatcher();
  // An empty datastore: bootstrap does no file I/O during load.
  const dataStore = new GenericDataStore(
    async () => [],
    async () => null
  );
  const foam = await bootstrap(
    [URI.file('/workspace')],
    matcher,
    watcher,
    dataStore,
    noopParser,
    [notesProvider],
    '.md'
  );
  return { watcher, foam };
}

describe('bootstrap file-watching', () => {
  it('coalesces a burst of create events into a single matcher refresh', async () => {
    const matcher = new CountingMatcher();
    const { watcher, foam } = await bootstrapWithWatcher(matcher);

    try {
      // Simulate the file churn a monorepo/build produces: many rapid creates.
      for (let i = 0; i < 50; i++) {
        watcher.fireCreate(URI.file(`/workspace/node_modules/pkg/file${i}.js`));
      }

      await flush(DEBOUNCE_SETTLE_MS);

      // A full `findFiles`/ripgrep scan per create event is what pins the CPU
      // (issue #1668). The burst must collapse to at most one refresh.
      expect(matcher.refreshCount).toBeLessThanOrEqual(1);
    } finally {
      foam.dispose();
    }
  });

  it('still fetches matched files created in a burst', async () => {
    const matcher = new CountingMatcher();
    const { watcher, foam } = await bootstrapWithWatcher(matcher);
    const added: string[] = [];
    foam.workspace.onDidAdd(r => added.push(r.uri.path));

    try {
      // A mix of matched (.md) notes and unmatched churn, created together.
      watcher.fireCreate(URI.file('/workspace/note-a.md'));
      watcher.fireCreate(URI.file('/workspace/node_modules/pkg/index.js'));
      watcher.fireCreate(URI.file('/workspace/note-b.md'));

      await flush(DEBOUNCE_SETTLE_MS);

      // Coalescing must not drop the real work: matched notes are still added,
      // and the unmatched file is skipped.
      expect(added.sort()).toEqual(['/workspace/note-a.md', '/workspace/note-b.md']);
    } finally {
      foam.dispose();
    }
  });

  it('does not refresh the matcher for creates after dispose', async () => {
    const matcher = new CountingMatcher();
    const { watcher, foam } = await bootstrapWithWatcher(matcher);

    foam.dispose();
    watcher.fireCreate(URI.file('/workspace/late.md'));
    await flush(DEBOUNCE_SETTLE_MS);

    expect(matcher.refreshCount).toBe(0);
  });
});
