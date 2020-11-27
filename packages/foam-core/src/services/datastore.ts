import glob from 'glob';
import { promisify } from 'util';
import micromatch from 'micromatch';
import fs from 'fs';
import { Event, Emitter } from '../common/event';
import { URI } from '../types';
import { FoamConfig } from '../config';
import { Logger } from '../utils/log';

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
   * Returns whether the given URI is a match in
   * this data store
   */
  isMatch: (uri: URI) => boolean;

  /**
   * Filters a list of URIs based on whether they are a match
   * in this data store
   */
  match: (uris: URI[]) => string[];

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
export class FileDataStore implements IDataStore {
  readonly onDidChangeEmitter = new Emitter<URI>();
  readonly onDidCreateEmitter = new Emitter<URI>();
  readonly onDidDeleteEmitter = new Emitter<URI>();
  readonly onDidCreate: Event<URI> = this.onDidCreateEmitter.event;
  readonly onDidChange: Event<URI> = this.onDidChangeEmitter.event;
  readonly onDidDelete: Event<URI> = this.onDidDeleteEmitter.event;
  readonly isMatch: (uri: URI) => boolean;
  readonly match: (uris: URI[]) => string[];

  private _folders: readonly string[];

  constructor(config: FoamConfig) {
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

    Logger.debug('Glob patterns', {
      includeGlobs,
      ignoreGlobs,
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
