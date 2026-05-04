import micromatch from 'micromatch';
import { URI, IMatcher } from '@foam/core';

export class GlobMatcher implements IMatcher {
  private readonly rootPath: string;

  constructor(
    public readonly include: string[] = ['**/*'],
    public readonly exclude: string[] = [],
    rootDir: URI
  ) {
    this.rootPath = rootDir.path.endsWith('/') ? rootDir.path : rootDir.path + '/';
  }

  match(files: URI[]): URI[] {
    return files.filter(f => this.isMatch(f));
  }

  isMatch(uri: URI): boolean {
    const rel = uri.path.startsWith(this.rootPath)
      ? uri.path.slice(this.rootPath.length)
      : uri.path;
    return (
      micromatch.isMatch(rel, this.include) &&
      (this.exclude.length === 0 || !micromatch.isMatch(rel, this.exclude))
    );
  }

  refresh(): Promise<void> {
    return Promise.resolve();
  }
}
