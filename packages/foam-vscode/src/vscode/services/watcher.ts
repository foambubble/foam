import { IDisposable } from '@foam/core';
import { Emitter } from '@foam/core';
import { IWatcher } from '@foam/core';
import { URI } from '@foam/core';
import { Event, FileSystemWatcher, TextDocument, Uri } from 'vscode';
import { fromVsCodeUri } from '../utils/vsc-utils';

const DEBOUNCE_MS = 100;

/**
 * VS Code reports a folder created, deleted, moved or renamed as one event for
 * the folder, and may not report the files inside it at all (e.g. on Linux,
 * files written before the new folder is watched). Watchers matching folders
 * make up for it: a created folder is expanded into its files, and a deleted
 * one is forwarded for the consumer to expand.
 */
export interface FolderWatch {
  watchers: FileSystemWatcher[];
  /** The files to report as created under `uri`, or none if it isn't a folder */
  listFilesInFolder: (uri: Uri) => Promise<Uri[]>;
}

export class VsCodeWatcher implements IWatcher, IDisposable {
  public onDidCreateEmitter = new Emitter<URI>();
  public onDidChangeEmitter = new Emitter<URI>();
  public onDidDeleteEmitter = new Emitter<URI>();
  onDidCreate = this.onDidCreateEmitter.event;
  onDidChange = this.onDidChangeEmitter.event;
  onDidDelete = this.onDidDeleteEmitter.event;

  private changeTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly vsCodeWatchers: FileSystemWatcher[];

  constructor(
    vsCodeWatcher: FileSystemWatcher | FileSystemWatcher[],
    onDidSaveTextDocument?: Event<TextDocument>,
    folderWatch?: FolderWatch
  ) {
    // Multiple watchers support multi-root workspaces, where each folder gets
    // its own scoped RelativePattern watcher.
    const fileWatchers = Array.isArray(vsCodeWatcher)
      ? vsCodeWatcher
      : [vsCodeWatcher];
    this.vsCodeWatchers = [...fileWatchers, ...(folderWatch?.watchers ?? [])];

    for (const w of fileWatchers) {
      w.onDidCreate(uri =>
        this.onDidCreateEmitter.fire(fromVsCodeUri(uri))
      );
      w.onDidChange(uri => this.fireChange(fromVsCodeUri(uri)));
      w.onDidDelete(uri =>
        this.onDidDeleteEmitter.fire(fromVsCodeUri(uri))
      );
    }
    onDidSaveTextDocument?.(doc => this.fireChange(fromVsCodeUri(doc.uri)));

    for (const w of folderWatch?.watchers ?? []) {
      w.onDidCreate(async uri => {
        for (const file of await folderWatch.listFilesInFolder(uri)) {
          this.onDidCreateEmitter.fire(fromVsCodeUri(file));
        }
      });
      w.onDidDelete(uri =>
        this.onDidDeleteEmitter.fire(fromVsCodeUri(uri))
      );
    }
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

  dispose(): void {
    for (const timer of this.changeTimers.values()) {
      clearTimeout(timer);
    }
    this.changeTimers.clear();
    for (const w of this.vsCodeWatchers) {
      w.dispose();
    }
  }
}
