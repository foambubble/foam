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

/** With nested roots, the innermost one owns the path. */
function findOwner<R extends { prefix: string }>(
  roots: R[],
  path: string
): R | undefined {
  let owner: R | undefined;
  for (const root of roots) {
    if (
      path.startsWith(root.prefix) &&
      (!owner || root.prefix.length > owner.prefix.length)
    ) {
      owner = root;
    }
  }
  return owner;
}

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
    const owner = findOwner(this.roots, uri.path);
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

/**
 * An {@link IMatcher} for placeholders, which are link targets rather than
 * files.
 *
 * Only exclude globs apply: the include globs already selected the notes the
 * links come from, and say nothing about where a missing note would live. A
 * placeholder from a path link lies under a workspace root and is tested
 * relative to it, like a file. One from a wikilink keeps the link text as its
 * path (`missing-note`, `journal/2024-01-01`) and lies under no root, so that
 * path is tested as is — a leading slash meaning the workspace root — against
 * every root's excludes.
 */
export class PlaceholderMatcher implements IMatcher {
  public readonly include = ['**/*'];
  public readonly exclude: string[];

  private readonly roots: { prefix: string; exclude: string[] }[];

  constructor(roots: Omit<GlobMatcherRoot, 'include'>[]) {
    this.roots = roots.map(r => ({
      prefix: asPrefix(r.uri.path),
      exclude: r.exclude,
    }));
    this.exclude = roots.flatMap(r => r.exclude);
  }

  match(uris: URI[]): URI[] {
    return uris.filter(u => this.isMatch(u));
  }

  isMatch(uri: URI): boolean {
    const owner = findOwner(this.roots, uri.path);
    return owner
      ? !micromatch.isMatch(
          uri.path.slice(owner.prefix.length),
          owner.exclude,
          MATCH_OPTIONS
        )
      : !micromatch.isMatch(
          uri.path.replace(/^\//, ''),
          this.exclude,
          MATCH_OPTIONS
        );
  }

  refresh(): Promise<void> {
    return Promise.resolve();
  }
}
