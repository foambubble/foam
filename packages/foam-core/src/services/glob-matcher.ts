import micromatch from 'micromatch';
import { URI } from '../model/uri';
import { IMatcher } from './datastore';

/**
 * A workspace root, with the include/exclude globs that apply within it.
 * Globs are relative to the root.
 */
export interface GlobMatcherRoot {
  uri: URI;
  include: string[];
  exclude: string[];
}

/**
 * micromatch options chosen to mirror how `workspace.findFiles` behaves today:
 *
 * - `dot`: findFiles returns files inside dot-directories — which is precisely
 *   why Foam has to exclude `.foam` explicitly. Without this, `**\/*` would
 *   match nothing under any dot-directory and quietly drop e.g. `.github/`
 *   notes from the index.
 * - `nocase`: findFiles follows the filesystem, so on Windows and default macOS
 *   an exclude of `**\/Archive/**` also excludes a folder named `archive`.
 */
const MATCH_OPTIONS: micromatch.Options = { dot: true, nocase: true };

const asPrefix = (path: string) => (path.endsWith('/') ? path : path + '/');

/**
 * An {@link IMatcher} that answers from the include/exclude globs directly.
 *
 * Unlike a matcher backed by a file listing, it holds no state that can go
 * stale, so {@link refresh} is a no-op and a path can be tested before it has
 * ever been listed — which is what makes it safe to check a file that was just
 * created or moved.
 */
export class GlobMatcher implements IMatcher {
  public readonly include: string[];
  public readonly exclude: string[];

  private readonly roots: { prefix: string; include: string[]; exclude: string[] }[];

  constructor(roots: GlobMatcherRoot[]) {
    this.roots = roots.map(r => ({
      prefix: asPrefix(r.uri.path),
      include: r.include,
      exclude: r.exclude,
    }));
    this.include = roots.flatMap(r => r.include);
    this.exclude = roots.flatMap(r => r.exclude);
  }

  match(files: URI[]): URI[] {
    return files.filter(f => this.isMatch(f));
  }

  isMatch(uri: URI): boolean {
    // With nested roots, the innermost one owns the file.
    let owner: (typeof this.roots)[number] | undefined;
    for (const root of this.roots) {
      if (
        uri.path.startsWith(root.prefix) &&
        (!owner || root.prefix.length > owner.prefix.length)
      ) {
        owner = root;
      }
    }
    if (!owner || owner.include.length === 0) {
      return false;
    }
    const relativePath = uri.path.slice(owner.prefix.length);
    return (
      micromatch.isMatch(relativePath, owner.include, MATCH_OPTIONS) &&
      !micromatch.isMatch(relativePath, owner.exclude, MATCH_OPTIONS)
    );
  }

  refresh(): Promise<void> {
    return Promise.resolve();
  }
}
