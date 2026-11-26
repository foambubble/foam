/* @unit-ready */
import { URI } from '@foam/core';
import { wait } from '../../test/test-utils';
import { VsCodeWatcher } from './watcher';

// longer than the 100ms VsCodeWatcher waits before reporting a change
const AFTER_DEBOUNCE_MS = 150;

// Minimal stubs for VS Code types used by VsCodeWatcher

type Listener<T> = (value: T) => void;

function makeUri(path: string) {
  return {
    scheme: 'file',
    authority: '',
    path,
    query: '',
    fragment: '',
    fsPath: path,
    toString: () => `file://${path}`,
  } as any;
}

function makeFsWatcher() {
  const listeners = {
    create: [] as Listener<any>[],
    change: [] as Listener<any>[],
    delete: [] as Listener<any>[],
  };
  return {
    onDidCreate: (fn: Listener<any>) => { listeners.create.push(fn); return { dispose: () => {} }; },
    onDidChange: (fn: Listener<any>) => { listeners.change.push(fn); return { dispose: () => {} }; },
    onDidDelete: (fn: Listener<any>) => { listeners.delete.push(fn); return { dispose: () => {} }; },
    dispose: vi.fn(),
    fire: {
      create: (uri: any) => listeners.create.forEach(fn => fn(uri)),
      change: (uri: any) => listeners.change.forEach(fn => fn(uri)),
      delete: (uri: any) => listeners.delete.forEach(fn => fn(uri)),
    },
  };
}

function makeSaveEvent() {
  const listeners: Listener<any>[] = [];
  const event = (fn: Listener<any>) => {
    listeners.push(fn);
    return { dispose: () => {} };
  };
  event.fire = (doc: any) => listeners.forEach(fn => fn(doc));
  return event;
}

describe('VsCodeWatcher', () => {
  it('forwards create and delete events immediately', () => {
    const fsWatcher = makeFsWatcher();
    const watcher = new VsCodeWatcher(fsWatcher as any);

    const created: URI[] = [];
    const deleted: URI[] = [];
    watcher.onDidCreate(uri => created.push(uri));
    watcher.onDidDelete(uri => deleted.push(uri));

    fsWatcher.fire.create(makeUri('/notes/a.md'));
    fsWatcher.fire.delete(makeUri('/notes/b.md'));

    expect(created).toHaveLength(1);
    expect(deleted).toHaveLength(1);
  });

  it('debounces rapid change events for the same URI', async () => {
    const fsWatcher = makeFsWatcher();
    const watcher = new VsCodeWatcher(fsWatcher as any);

    const changed: URI[] = [];
    watcher.onDidChange(uri => changed.push(uri));

    const uri = makeUri('/notes/a.md');
    fsWatcher.fire.change(uri);
    fsWatcher.fire.change(uri);
    fsWatcher.fire.change(uri);

    expect(changed).toHaveLength(0);
    await wait(AFTER_DEBOUNCE_MS);
    expect(changed).toHaveLength(1);
  });

  it('emits separate change events for different URIs', async () => {
    const fsWatcher = makeFsWatcher();
    const watcher = new VsCodeWatcher(fsWatcher as any);

    const changed: URI[] = [];
    watcher.onDidChange(uri => changed.push(uri));

    fsWatcher.fire.change(makeUri('/notes/a.md'));
    fsWatcher.fire.change(makeUri('/notes/b.md'));

    await wait(AFTER_DEBOUNCE_MS);
    expect(changed).toHaveLength(2);
  });

  it('fires a change event when a document is saved (symlink augmentation)', async () => {
    const fsWatcher = makeFsWatcher();
    const saveEvent = makeSaveEvent();
    const watcher = new VsCodeWatcher(fsWatcher as any, saveEvent as any);

    const changed: URI[] = [];
    watcher.onDidChange(uri => changed.push(uri));

    saveEvent.fire({ uri: makeUri('/symlinked/note.md') });

    expect(changed).toHaveLength(0);
    await wait(AFTER_DEBOUNCE_MS);
    expect(changed).toHaveLength(1);
  });

  it('deduplicates a save event and a file system change for the same URI within 100ms', async () => {
    const fsWatcher = makeFsWatcher();
    const saveEvent = makeSaveEvent();
    const watcher = new VsCodeWatcher(fsWatcher as any, saveEvent as any);

    const changed: URI[] = [];
    watcher.onDidChange(uri => changed.push(uri));

    const uri = makeUri('/notes/a.md');
    fsWatcher.fire.change(uri);
    saveEvent.fire({ uri });

    await wait(AFTER_DEBOUNCE_MS);
    expect(changed).toHaveLength(1);
  });

  it('disposes cleanly without firing pending timers', async () => {
    const fsWatcher = makeFsWatcher();
    const watcher = new VsCodeWatcher(fsWatcher as any);

    const changed: URI[] = [];
    watcher.onDidChange(uri => changed.push(uri));

    fsWatcher.fire.change(makeUri('/notes/a.md'));
    watcher.dispose();

    await wait(AFTER_DEBOUNCE_MS);
    expect(changed).toHaveLength(0);
    expect(fsWatcher.dispose).toHaveBeenCalled();
  });

  describe('multiple underlying watchers (multi-root)', () => {
    it('forwards create/delete events from every watcher', () => {
      const w1 = makeFsWatcher();
      const w2 = makeFsWatcher();
      const watcher = new VsCodeWatcher([w1, w2] as any);

      const created: URI[] = [];
      watcher.onDidCreate(uri => created.push(uri));

      w1.fire.create(makeUri('/root1/a.md'));
      w2.fire.create(makeUri('/root2/b.md'));

      expect(created.map(u => u.path).sort()).toEqual([
        '/root1/a.md',
        '/root2/b.md',
      ]);
    });

    it('forwards change events from every watcher', async () => {
      const w1 = makeFsWatcher();
      const w2 = makeFsWatcher();
      const watcher = new VsCodeWatcher([w1, w2] as any);

      const changed: URI[] = [];
      watcher.onDidChange(uri => changed.push(uri));

      w1.fire.change(makeUri('/root1/a.md'));
      w2.fire.change(makeUri('/root2/b.md'));

      await wait(AFTER_DEBOUNCE_MS);
      expect(changed).toHaveLength(2);
    });

    it('disposes every underlying watcher', () => {
      const w1 = makeFsWatcher();
      const w2 = makeFsWatcher();
      const watcher = new VsCodeWatcher([w1, w2] as any);

      watcher.dispose();

      expect(w1.dispose).toHaveBeenCalled();
      expect(w2.dispose).toHaveBeenCalled();
    });
  });
});
