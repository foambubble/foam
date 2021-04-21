import glob from 'glob';
import micromatch from 'micromatch';
import fs from 'fs';
import { URI } from '../model/uri';
import { FoamConfig } from '../config';
import { Logger } from '../utils/log';

export interface IMatcher {
  match(files: URI[]): URI[];
  isMatch(uri: URI): boolean;
}

export class Matcher implements IMatcher {
  folders: readonly string[];
  private _includeGlobs: string[] = [];
  private _ignoreGlobs: string[] = [];

  constructor(config: FoamConfig) {
    this.folders = config.workspaceFolders.map(f =>
      URI.toFsPath(f).replace(/\\/g, '/')
    );
    Logger.info('Workspace folders: ', this.folders);

    this.folders.forEach(folder => {
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
  }

  match(files: URI[]) {
    const matches = micromatch(
      files.map(f => URI.toFsPath(f)),
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
}

/**
 * Represents a source of files and content
 */
export interface IDataStore {
  /**
   * Read the content of the file from the store
   *
   * Returns `null` in case of errors while reading
   */
  read: (uri: URI) => Promise<string | null>;
}

/**
 * File system based data store
 */
export class FileDataStore implements IDataStore {
  async read(uri: URI) {
    try {
      return (await fs.promises.readFile(URI.toFsPath(uri))).toString();
    } catch (e) {
      Logger.error(
        `FileDataStore: error while reading uri: ${uri.path} - ${e}`
      );
      return null;
    }
  }
}

export const folderPlusGlob = (folder: string) => (glob: string): string => {
  if (folder.substr(-1) === '/') {
    folder = folder.slice(0, -1);
  }
  if (glob.startsWith('/')) {
    glob = glob.slice(1);
  }
  return `${folder}/${glob}`;
};
