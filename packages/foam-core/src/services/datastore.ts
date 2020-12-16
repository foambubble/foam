import glob from 'glob';
import { promisify } from 'util';
import micromatch from 'micromatch';
import fs from 'fs';
import { Event, Emitter } from '../common/event';
import { URI } from '../common/uri';
import { FoamConfig } from '../config';
import { Logger } from '../utils/log';
import { isSome } from '../utils';
import { IDisposable } from '../common/lifecycle';

const findAllFiles = promisify(glob);

export interface IWatcher {
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
   * Returns whether the given URI is a match in
   * this data store
   */
  isMatch: (uri: URI) => boolean;

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
 * File system based data store
 */
export class FileDataStore implements IDataStore, IDisposable {
  readonly onDidChangeEmitter = new Emitter<URI>();
  readonly onDidCreateEmitter = new Emitter<URI>();
  readonly onDidDeleteEmitter = new Emitter<URI>();
  readonly onDidCreate: Event<URI> = this.onDidCreateEmitter.event;
  readonly onDidChange: Event<URI> = this.onDidChangeEmitter.event;
  readonly onDidDelete: Event<URI> = this.onDidDeleteEmitter.event;

  private _folders: readonly string[];
  private _includeGlobs: string[] = [];
  private _ignoreGlobs: string[] = [];
  private _disposables: IDisposable[] = [];

  constructor(config: FoamConfig, watcher?: IWatcher) {
    this._folders = config.workspaceFolders.map(f =>
      f.fsPath.replace(/\\/g, '/')
    );
    Logger.info('Workspace folders: ', this._folders);

    this._folders.forEach(folder => {
      const withFolder = folderPlusGlob(folder);
      this._includeGlobs.push(
        ...config.includeGlobs.map(glob => {
          if (glob.endsWith('*')) {
            glob = `${glob}\\.(md|mdx|markdown)`;
          }
          return withFolder(glob);
        })
      );
      this._ignoreGlobs.push(...config.ignoreGlobs.map(withFolder));
    });
    Logger.info('Glob patterns', {
      includeGlobs: this._includeGlobs,
      ignoreGlobs: this._ignoreGlobs,
    });

    if (isSome(watcher)) {
      this._disposables.push(
        watcher.onDidCreate(async uri => {
          if (this.isMatch(uri)) {
            Logger.info(`Created: ${uri.path}`);
            this.onDidCreateEmitter.fire(uri);
          }
        }),
        watcher.onDidChange(uri => {
          if (this.isMatch(uri)) {
            Logger.info(`Updated: ${uri.path}`);
            this.onDidChangeEmitter.fire(uri);
          }
        }),
        watcher.onDidDelete(uri => {
          if (this.isMatch(uri)) {
            Logger.info(`Deleted: ${uri.path}`);
            this.onDidDeleteEmitter.fire(uri);
          }
        })
      );
    }
  }

  match(files: URI[]) {
    const matches = micromatch(
      files.map(f => f.fsPath),
      this._includeGlobs,
      {
        ignore: this._ignoreGlobs,
        nocase: true,
      }
    );
    return matches.map(URI.file);
  }

  isMatch(uri: URI) {
    return this.match([uri]).length > 0;
  }

  async listFiles() {
    const files = (
      await Promise.all(
        this._folders.map(async folder => {
          const res = await findAllFiles(folderPlusGlob(folder)('**/*'));
          return res.map(URI.file);
        })
      )
    ).flat();
    return this.match(files);
  }

  async read(uri: URI) {
    return (await fs.promises.readFile(uri.fsPath)).toString();
  }

  dispose() {
    this._disposables.forEach(d => d.dispose());
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
