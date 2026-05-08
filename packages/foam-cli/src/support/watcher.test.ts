import { mkdtempSync, writeFileSync, rmSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { URI } from '@foam/core';
import { NodeWatcher } from './watcher';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const collect = (watcher: NodeWatcher) => {
  const created: URI[] = [];
  const changed: URI[] = [];
  const deleted: URI[] = [];
  watcher.onDidCreate(u => created.push(u));
  watcher.onDidChange(u => changed.push(u));
  watcher.onDidDelete(u => deleted.push(u));
  return { created, changed, deleted };
};

describe('NodeWatcher', () => {
  it('fires onDidCreate when a file is added after the watcher starts', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'foam-watcher-create-'));
    const watcher = new NodeWatcher(dir);
    try {
      const events = collect(watcher);
      // Give chokidar a moment to settle on initial scan.
      await wait(150);
      const file = path.join(dir, 'new.md');
      writeFileSync(file, '# New');
      await wait(300);
      expect(events.created.map(u => u.toFsPath())).toContain(file);
    } finally {
      await watcher.dispose();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fires onDidDelete when a file is removed', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'foam-watcher-delete-'));
    const file = path.join(dir, 'doomed.md');
    writeFileSync(file, '# Doomed');
    const watcher = new NodeWatcher(dir);
    try {
      const events = collect(watcher);
      await wait(150);
      unlinkSync(file);
      await wait(300);
      expect(events.deleted.map(u => u.toFsPath())).toContain(file);
    } finally {
      await watcher.dispose();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('debounces rapid change events', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'foam-watcher-debounce-'));
    const file = path.join(dir, 'busy.md');
    writeFileSync(file, '# v0');
    const watcher = new NodeWatcher(dir);
    try {
      const events = collect(watcher);
      await wait(150);
      // Multiple rapid writes should coalesce into a single change after the
      // debounce window. awaitWriteFinish in chokidar already smooths bursts,
      // so we just check we don't get a flurry of duplicates.
      writeFileSync(file, '# v1');
      writeFileSync(file, '# v2');
      writeFileSync(file, '# v3');
      await wait(400);
      const matchingChanges = events.changed.filter(
        u => u.toFsPath() === file
      );
      expect(matchingChanges.length).toBeGreaterThanOrEqual(1);
      expect(matchingChanges.length).toBeLessThanOrEqual(2);
    } finally {
      await watcher.dispose();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not fire onDidCreate for pre-existing files (ignoreInitial)', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'foam-watcher-existing-'));
    writeFileSync(path.join(dir, 'pre-existing.md'), 'hello');
    const watcher = new NodeWatcher(dir);
    try {
      const events = collect(watcher);
      await wait(300);
      expect(events.created).toEqual([]);
    } finally {
      await watcher.dispose();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
