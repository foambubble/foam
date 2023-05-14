import { URI } from '../model/uri';
import { Logger } from '../utils/log';
import { Event } from '../common/event';

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

export interface IWatcher {
  onDidChange: Event<URI>;
  onDidCreate: Event<URI>;
  onDidDelete: Event<URI>;
}

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

/**
 * A matcher that instead of using globs uses a list of files to
 * check the matches.
 * The {@link refresh} function has been added to the interface to accommodate
 * this matcher, far from ideal but to be refactored later
 */
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

  static async createFromListFn(listFiles: () => Promise<URI[]>) {
    const files = await listFiles();
    return new FileListBasedMatcher(files, listFiles);
  }
}

/**
 * A matcher that includes all URIs passed to it
 */
export class AlwaysIncludeMatcher implements IMatcher {
  include: string[] = ['**/*'];
  exclude: string[] = [];
  match(files: URI[]): URI[] {
    return files;
  }

  isMatch(uri: URI): boolean {
    return true;
  }

  refresh(): Promise<void> {
    return;
  }
}

export class SubstringExcludeMatcher implements IMatcher {
  include: string[] = ['**/*'];
  exclude: string[] = [];
  constructor(exclude: string) {
    this.exclude = [exclude];
  }

  match(files: URI[]): URI[] {
    return files.filter(f => this.isMatch(f));
  }

  isMatch(uri: URI): boolean {
    return !uri.path.includes(this.exclude[0]);
  }

  refresh(): Promise<void> {
    return;
  }
}
