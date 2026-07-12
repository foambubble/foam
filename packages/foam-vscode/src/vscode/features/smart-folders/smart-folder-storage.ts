import * as vscode from 'vscode';
import {
  Emitter,
  IDisposable,
  LoadedQuery,
  Logger,
  QUERIES_GLOB,
  Query,
  QueryStore,
  URI,
  createQueryDataStore,
  idFromQueryFilename,
} from '@foam/core';
import { fromVsCodeUri, toVsCodeUri } from '../../utils/vsc-utils';
import { writeFile } from '../../services/editor';

/**
 * VS Code adapter for the core {@link QueryStore}: adds a
 * {@link vscode.FileSystemWatcher} + an in-memory cache so the tree view
 * can re-render without re-reading every YAML on each refresh.
 */
export class SmartFolderStorage implements IDisposable {
  private cache: Map<string, LoadedQuery> = new Map();
  private onDidUpdateEmitter = new Emitter<void>();
  public onDidUpdate = this.onDidUpdateEmitter.event;
  private watcher: vscode.FileSystemWatcher | undefined;
  private disposables: vscode.Disposable[] = [];
  private store: QueryStore | undefined;

  constructor(private workspaceRoot: URI | undefined) {
    if (workspaceRoot) {
      const dataStore = createQueryDataStore(
        createVsCodeQueryOps(workspaceRoot)
      );
      this.store = new QueryStore(dataStore, workspaceRoot);
    }
  }

  async start(): Promise<void> {
    if (!this.workspaceRoot || !this.store) {
      return;
    }
    await this.reloadAll();

    // The watcher tracks the same set of files the QueryStore enumerates.
    // We have to repeat the glob here because vscode requires it as a
    // RelativePattern up front; the matching definition stays in core.
    this.watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(toVsCodeUri(this.workspaceRoot), QUERIES_GLOB)
    );
    this.disposables.push(
      this.watcher,
      this.watcher.onDidCreate(uri => this.handleChange(fromVsCodeUri(uri))),
      this.watcher.onDidChange(uri => this.handleChange(fromVsCodeUri(uri))),
      this.watcher.onDidDelete(uri => this.handleDelete(fromVsCodeUri(uri)))
    );
  }

  list(): LoadedQuery[] {
    return Array.from(this.cache.values()).sort((a, b) =>
      a.query.name.localeCompare(b.query.name)
    );
  }

  get(id: string): LoadedQuery | undefined {
    return this.cache.get(id);
  }

  getFileUri(id: string): URI | undefined {
    return this.store?.getFileUri(id);
  }

  async save(query: Query): Promise<URI> {
    if (!this.store) {
      throw new Error('No workspace folder open');
    }
    return this.store.save(query);
  }

  async delete(id: string): Promise<void> {
    if (!this.store) return;
    await this.store.delete(id);
  }

  async exists(id: string): Promise<boolean> {
    if (!this.store) return false;
    return this.store.exists(id);
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
    this.onDidUpdateEmitter.dispose();
  }

  private async reloadAll(): Promise<void> {
    if (!this.store) return;
    this.cache.clear();
    const loaded = await this.store.loadAll();
    for (const item of loaded) {
      this.cache.set(item.query.id, item);
    }
  }

  private async handleChange(uri: URI): Promise<void> {
    if (!this.store) return;
    const loaded = await this.store.load(uri);
    if (loaded) {
      this.cache.set(loaded.query.id, loaded);
    } else {
      Logger.warn(`Failed to load query file ${uri.toString()}`);
      this.cache.delete(idFromQueryFilename(uri.getName()));
    }
    this.onDidUpdateEmitter.fire();
  }

  private handleDelete(uri: URI): void {
    this.cache.delete(idFromQueryFilename(uri.getName()));
    this.onDidUpdateEmitter.fire();
  }
}

function createVsCodeQueryOps(workspaceRoot: URI) {
  const decoder = new TextDecoder('utf-8');

  return {
    list: async (pattern: string): Promise<URI[]> => {
      const uris = await vscode.workspace.findFiles(
        new vscode.RelativePattern(toVsCodeUri(workspaceRoot), pattern)
      );
      return uris.map(fromVsCodeUri);
    },
    read: async (uri: URI) => {
      const bytes = await vscode.workspace.fs.readFile(toVsCodeUri(uri));
      return decoder.decode(bytes);
    },
    write: writeFile,
    delete: async (uri: URI) => {
      await vscode.workspace.fs.delete(toVsCodeUri(uri));
    },
    move: async (from: URI, to: URI) => {
      await vscode.workspace.fs.createDirectory(toVsCodeUri(to.getDirectory()));
      await vscode.workspace.fs.rename(toVsCodeUri(from), toVsCodeUri(to), {
        overwrite: false,
      });
    },
    exists: async (uri: URI) => {
      try {
        await vscode.workspace.fs.stat(toVsCodeUri(uri));
        return true;
      } catch {
        return false;
      }
    },
  };
}
