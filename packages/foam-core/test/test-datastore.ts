import micromatch from 'micromatch';
import { Logger } from '../src/utils/log';
import { IDataStore, IMatcher } from '../src/services/datastore';
import { URI } from '../src/model/uri';
import { isWindows } from '../src/common/platform';
import { asAbsolutePaths } from '../src/utils/path';
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

export class FileDataStore implements IDataStore {
  constructor(
    private readFile: (uri: URI) => Promise<string>,
    private readonly basedir: string
  ) {}

  async list(pattern?: string): Promise<URI[]> {
    const res = getFiles(this.basedir);
    if (!pattern) {
      return res.map(URI.file);
    }
    const absoluteGlob = path.posix.join(this.basedir, pattern);
    const matches = micromatch(res, [absoluteGlob]);
    return matches.map(URI.file);
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

  async write(uri: URI, content: string): Promise<void> {
    const fsPath = uri.toFsPath();
    fs.mkdirSync(path.dirname(fsPath), { recursive: true });
    fs.writeFileSync(fsPath, content, 'utf8');
  }

  async delete(uri: URI): Promise<void> {
    try {
      fs.unlinkSync(uri.toFsPath());
    } catch (err: any) {
      if (err.code !== 'ENOENT') throw err;
    }
  }

  async move(from: URI, to: URI): Promise<void> {
    const toFs = to.toFsPath();
    fs.mkdirSync(path.dirname(toFs), { recursive: true });
    fs.renameSync(from.toFsPath(), toFs);
  }

  async exists(uri: URI): Promise<boolean> {
    return fs.existsSync(uri.toFsPath());
  }
}

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
