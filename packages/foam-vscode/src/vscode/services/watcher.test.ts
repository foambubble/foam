import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { URI } from '../../core/model/uri';
import { VsCodeWatcher } from './watcher';

// Minimal stubs for VS Code types used by VsCodeWatcher

type Listener<T> = (value: T) => void;

function makeUri(path: string) {
  return { toString: () => `file://${path}`, fsPath: path } as any;
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
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

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

  it('debounces rapid change events for the same URI', () => {
    const fsWatcher = makeFsWatcher();
    const watcher = new VsCodeWatcher(fsWatcher as any);

    const changed: URI[] = [];
    watcher.onDidChange(uri => changed.push(uri));

    const uri = makeUri('/notes/a.md');
    fsWatcher.fire.change(uri);
    fsWatcher.fire.change(uri);
    fsWatcher.fire.change(uri);

    expect(changed).toHaveLength(0);
    vi.advanceTimersByTime(100);
    expect(changed).toHaveLength(1);
  });

  it('emits separate change events for different URIs', () => {
    const fsWatcher = makeFsWatcher();
    const watcher = new VsCodeWatcher(fsWatcher as any);

    const changed: URI[] = [];
    watcher.onDidChange(uri => changed.push(uri));

    fsWatcher.fire.change(makeUri('/notes/a.md'));
    fsWatcher.fire.change(makeUri('/notes/b.md'));

    vi.advanceTimersByTime(100);
    expect(changed).toHaveLength(2);
  });

  it('fires a change event when a document is saved (symlink augmentation)', () => {
    const fsWatcher = makeFsWatcher();
    const saveEvent = makeSaveEvent();
    const watcher = new VsCodeWatcher(fsWatcher as any, saveEvent as any);

    const changed: URI[] = [];
    watcher.onDidChange(uri => changed.push(uri));

    saveEvent.fire({ uri: makeUri('/symlinked/note.md') });

    expect(changed).toHaveLength(0);
    vi.advanceTimersByTime(100);
    expect(changed).toHaveLength(1);
  });

  it('deduplicates a save event and a file system change for the same URI within 100ms', () => {
    const fsWatcher = makeFsWatcher();
    const saveEvent = makeSaveEvent();
    const watcher = new VsCodeWatcher(fsWatcher as any, saveEvent as any);

    const changed: URI[] = [];
    watcher.onDidChange(uri => changed.push(uri));

    const uri = makeUri('/notes/a.md');
    fsWatcher.fire.change(uri);
    saveEvent.fire({ uri });

    vi.advanceTimersByTime(100);
    expect(changed).toHaveLength(1);
  });

  it('disposes cleanly without firing pending timers', () => {
    const fsWatcher = makeFsWatcher();
    const watcher = new VsCodeWatcher(fsWatcher as any);

    const changed: URI[] = [];
    watcher.onDidChange(uri => changed.push(uri));

    fsWatcher.fire.change(makeUri('/notes/a.md'));
    watcher.dispose();

    vi.advanceTimersByTime(100);
    expect(changed).toHaveLength(0);
    expect(fsWatcher.dispose).toHaveBeenCalled();
  });
});
