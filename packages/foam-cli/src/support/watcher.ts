import chokidar, { FSWatcher } from 'chokidar';
import { Emitter, IDisposable, IWatcher, URI } from '@foam/core';

const DEBOUNCE_MS = 100;

/**
 * Node-side counterpart to VsCodeWatcher: turns chokidar events into the
 * IWatcher contract that bootstrap() expects, with a small debounce on
 * change events to coalesce save bursts.
 *
 * Construct with the same set of paths/globs the workspace was loaded
 * with so the watcher and the in-memory graph stay in sync.
 */
export class NodeWatcher implements IWatcher, IDisposable {
  public onDidCreateEmitter = new Emitter<URI>();
  public onDidChangeEmitter = new Emitter<URI>();
  public onDidDeleteEmitter = new Emitter<URI>();
  onDidCreate = this.onDidCreateEmitter.event;
  onDidChange = this.onDidChangeEmitter.event;
  onDidDelete = this.onDidDeleteEmitter.event;

  private readonly fsWatcher: FSWatcher;
  private readonly changeTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    paths: string[] | string,
    options: { ignored?: (string | RegExp)[] } = {}
  ) {
    this.fsWatcher = chokidar.watch(paths, {
      ignored: options.ignored,
      // Don't fire `add` for files that already exist when the watcher starts —
      // the workspace bootstrap already loaded them.
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 50,
        pollInterval: 25,
      },
    });

    this.fsWatcher.on('add', filePath =>
      this.onDidCreateEmitter.fire(URI.file(filePath))
    );
    this.fsWatcher.on('change', filePath =>
      this.fireChange(URI.file(filePath))
    );
    this.fsWatcher.on('unlink', filePath =>
      this.onDidDeleteEmitter.fire(URI.file(filePath))
    );
  }

  private fireChange(uri: URI): void {
    const key = uri.path;
    const existing = this.changeTimers.get(key);
    if (existing) {
      clearTimeout(existing);
    }
    this.changeTimers.set(
      key,
      setTimeout(() => {
        this.changeTimers.delete(key);
        this.onDidChangeEmitter.fire(uri);
      }, DEBOUNCE_MS)
    );
  }

  async dispose(): Promise<void> {
    for (const timer of this.changeTimers.values()) {
      clearTimeout(timer);
    }
    this.changeTimers.clear();
    await this.fsWatcher.close();
  }
}
