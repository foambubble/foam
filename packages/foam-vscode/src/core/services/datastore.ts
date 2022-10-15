import micromatch from 'micromatch';
import { URI } from '../model/uri';
import { Logger } from '../utils/log';
import { glob } from 'glob';
import { promisify } from 'util';
import { isWindows } from '../common/platform';
import { Event } from '../common/event';
import { asAbsolutePaths } from '../utils/path';

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
   * Refreshes the list of files that this matcher matches
   * To be used when new files are added to the workspace,
   * it can be a more or less expensive operation depending on the
   * implementation of the matcher
   */
  refresh(): Promise<void>;

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

export class FileListBasedMatcher implements IMatcher {
  private files: string[] = [];
  include: string[];
  exclude: string[];

  constructor(files: URI[], private readonly listFiles: () => Promise<URI[]>) {
    this.files = files.map(f => f.path);
  }

  match(files: URI[]): URI[] {
    return files.filter(f => this.files.includes(f.path));
  }

  isMatch(uri: URI): boolean {
    return this.files.includes(uri.path);
  }

  async refresh() {
    this.files = (await this.listFiles()).map(f => f.path);
  }
}

export interface IWatcher {
  onDidChange: Event<URI>;
  onDidCreate: Event<URI>;
  onDidDelete: Event<URI>;
}

/**
 * Represents a source of files and content
 */
export interface IDataStore {
  /**
   * List the files matching the given glob from the
   * store
   */
  list: () => Promise<URI[]>;

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
  constructor(
    private readFile: (uri: URI) => Promise<string>,
    private readonly basedir: string
  ) {}

  async list(): Promise<URI[]> {
    const res = await findAllFiles([this.basedir, '**/*'].join('/'));
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

export class GenericDataStore implements IDataStore {
  constructor(
    private readonly listFiles: () => Promise<URI[]>,
    private readFile: (uri: URI) => Promise<string>
  ) {}

  async list(): Promise<URI[]> {
    return this.listFiles();
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
