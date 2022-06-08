import micromatch from 'micromatch';
import { URI } from '../model/uri';
import { Logger } from '../utils/log';
import { glob } from 'glob';
import { promisify } from 'util';
import { isWindows } from '../common/platform';

const findAllFiles = promisify(glob);

export interface IMatcher {
  /**
   * Filters the given list of URIs, keepin only the ones that
   * are matched by this Matcher
   *
   * @param files the URIs to check
   */
  match(files: URI[]): URI[];

  /**
   * Returns whether this URI is matched by this Matcher
   *
   * @param uri the URI to check
   */
  isMatch(uri: URI): boolean;

  /**
   * The include globs
   */
  include: string[];

  /**
   * The exclude lobs
   */
  exclude: string[];
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
    include: string[] = ['**/*'],
    exclude: string[] = []
  ) {
    this.folders = baseFolders.map(toMatcherPathFormat);
    Logger.info('Workspace folders: ', this.folders);

    this.folders.forEach(folder => {
      const withFolder = folderPlusGlob(folder);
      this.include.push(
        ...include.map(glob => {
          return withFolder(glob);
        })
      );
      this.exclude.push(...exclude.map(withFolder));
    });
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
}

/**
 * Represents a source of files and content
 */
export interface IDataStore {
  /**
   * List the files matching the given glob from the
   * store
   */
  list: (glob: string, ignoreGlob?: string | string[]) => Promise<URI[]>;

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
  constructor(private readFile: (uri: URI) => Promise<string>) {}

  async list(glob: string, ignoreGlob?: string | string[]): Promise<URI[]> {
    const res = await findAllFiles(glob, {
      ignore: ignoreGlob,
      strict: false,
    });
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

export const folderPlusGlob = (folder: string) => (glob: string): string => {
  if (folder.substr(-1) === '/') {
    folder = folder.slice(0, -1);
  }
  if (glob.startsWith('/')) {
    glob = glob.slice(1);
  }
  return folder.length > 0 ? `${folder}/${glob}` : glob;
};
