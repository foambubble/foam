import micromatch from 'micromatch';
import { Logger } from '../core/utils/log';
import { IDataStore, IMatcher } from '../core/services/datastore';
import { URI } from '../core/model/uri';
import { isWindows } from '../core/common/platform';
import { asAbsolutePaths } from '../core/utils/path';
import fs from 'fs';
import path from 'path';

function getFiles(directory: string) {
  const files = [];
  getFilesFromDir(files, directory);
  return files;
}
function getFilesFromDir(files: string[], directory: string) {
  fs.readdirSync(directory).forEach(file => {
    const absolute = path.join(directory, file);
    if (fs.statSync(absolute).isDirectory()) {
      getFilesFromDir(files, absolute);
    } else {
      files.push(absolute);
    }
  });
}
/**
 * File system based data store
 */
export class FileDataStore implements IDataStore {
  constructor(
    private readFile: (uri: URI) => Promise<string>,
    private readonly basedir: string
  ) {}

  async list(): Promise<URI[]> {
    const res = getFiles(this.basedir);
    return res.map(URI.file);
  }

  async read(uri: URI) {
    try {
      return await this.readFile(uri);
    } catch (e) {
      Logger.error(
        `FileDataStore: error while reading uri: ${uri.path} - ${e}`
      );
      return null;
    }
  }
}

/**
 * The matcher requires the path to be in unix format, so if we are in windows
 * we convert the fs path on the way in and out
 */
export const toMatcherPathFormat = isWindows
  ? (uri: URI) => uri.toFsPath().replace(/\\/g, '/')
  : (uri: URI) => uri.toFsPath();

export const toFsPath = isWindows
  ? (path: string): string => path.replace(/\//g, '\\')
  : (path: string): string => path;

export class Matcher implements IMatcher {
  public readonly folders: string[];
  public readonly include: string[] = [];
  public readonly exclude: string[] = [];

  constructor(
    baseFolders: URI[],
    includeGlobs: string[] = ['**/*'],
    excludeGlobs: string[] = []
  ) {
    this.folders = baseFolders.map(toMatcherPathFormat);
    Logger.info('Workspace folders: ', this.folders);

    this.include = includeGlobs.flatMap(glob =>
      asAbsolutePaths(glob, this.folders)
    );
    this.exclude = excludeGlobs.flatMap(glob =>
      asAbsolutePaths(glob, this.folders)
    );

    Logger.info('Glob patterns', {
      includeGlobs: this.include,
      ignoreGlobs: this.exclude,
    });
  }

  match(files: URI[]) {
    const matches = micromatch(
      files.map(f => f.toFsPath()),
      this.include,
      {
        ignore: this.exclude,
        nocase: true,
        format: toFsPath,
      }
    );
    return matches.map(URI.file);
  }

  isMatch(uri: URI) {
    return this.match([uri]).length > 0;
  }

  refresh(): Promise<void> {
    return Promise.resolve();
  }
}
