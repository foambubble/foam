import glob from 'glob';
import { promisify } from 'util';
import micromatch from 'micromatch';
import fs from 'fs';
import { Event, Emitter } from '../common/event';
import { URI } from '../types';
import { IDisposable, isDisposable } from '../common/lifecycle';
import { FoamConfig } from '../config';

const findAllFiles = promisify(glob);

/**
 * Represents a source of files and content
 */
export interface IDataStore {
  /**
   * List the files available in the store
   */
  listFiles: () => Promise<URI[]>;

  /**
   * Read the content of the file from the store
   */
  read: (uri: URI) => Promise<string>;

  /**
   * An event which fires on file creation.
   */
  onDidCreate: Event<URI>;

  /**
   * An event which fires on file change.
   */
  onDidChange: Event<URI>;

  /**
   * An event which fires on file deletion.
   */
  onDidDelete: Event<URI>;
}

/**
 * Monitor a data store for changes in its content
 */
export interface IDataStoreWatcher {
  /**
   * Emitter that drives the data store onDidCreate event
   */
  onDidCreateEmitter: Emitter<URI>;
  /**
   * Emitter that drives the data store onDidChange event
   */
  onDidChangeEmitter: Emitter<URI>;
  /**
   * Emitter that drives the data store onDidDelete event
   */
  onDidDeleteEmitter: Emitter<URI>;
}

/**
 * Dummy datastore watcher that will never trigger an event
 */
export const NoopDatastoreWatcher: IDataStoreWatcher = {
  onDidCreateEmitter: new Emitter<URI>(),
  onDidChangeEmitter: new Emitter<URI>(),
  onDidDeleteEmitter: new Emitter<URI>(),
};

/**
 * File system based data store
 */
export class FileDataStore implements IDataStore, IDisposable {
  onDidCreate: Event<URI>;
  onDidChange: Event<URI>;
  onDidDelete: Event<URI>;
  isMatch: (uri: URI) => boolean;
  match: (uris: URI[]) => string[];

  private _folders: readonly string[];
  private _watcher: IDataStoreWatcher;

  constructor(config: FoamConfig, watcher?: IDataStoreWatcher) {
    watcher = watcher ?? NoopDatastoreWatcher;
    this.onDidCreate = watcher.onDidCreateEmitter.event;
    this.onDidChange = watcher.onDidChangeEmitter.event;
    this.onDidDelete = watcher.onDidDeleteEmitter.event;
    this._watcher = watcher;
    this._folders = config.workspaceFolders;

    let includeGlobs: string[] = [];
    let ignoreGlobs: string[] = [];
    config.workspaceFolders.forEach(folder => {
      const withFolder = folderPlusGlob(folder);
      includeGlobs.push(
        ...config.includeGlobs.map(glob => {
          if (glob.endsWith('*')) {
            glob = `${glob}\\.(md|mdx|markdown)`;
          }
          return withFolder(glob);
        })
      );
      ignoreGlobs.push(...config.ignoreGlobs.map(withFolder));
    });

    this.match = (files: URI[]) => {
      return micromatch(files, includeGlobs, {
        ignore: ignoreGlobs,
        nocase: true,
      });
    };
    this.isMatch = uri => this.match([uri]).length > 0;
  }

  async listFiles() {
    const files = (
      await Promise.all(
        this._folders.map(folder => {
          return findAllFiles(folderPlusGlob(folder)('**/*'));
        })
      )
    ).flat();
    return this.match(files);
  }

  async read(uri: URI) {
    return (await fs.promises.readFile(uri)).toString();
  }

  dispose(): void {
    if (isDisposable(this._watcher)) {
      this._watcher.dispose();
    }
  }
}

const folderPlusGlob = (folder: string) => (glob: string): string => {
  if (folder.substr(-1) === '/') {
    folder = folder.slice(0, -1);
  }
  if (glob.startsWith('/')) {
    glob = glob.slice(1);
  }
  return `${folder}/${glob}`;
};
