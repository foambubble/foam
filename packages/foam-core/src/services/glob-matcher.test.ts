import { GlobMatcher } from './glob-matcher';
import { URI } from '../model/uri';

const root = URI.file('/workspace');

describe('GlobMatcher', () => {
  it('includes files matching the include globs', () => {
    const matcher = new GlobMatcher([
      { uri: root, include: ['**/*'], exclude: [] },
    ]);

    expect(matcher.isMatch(root.joinPath('notes/a.md'))).toBeTruthy();
    expect(matcher.isMatch(root.joinPath('deeply/nested/a.md'))).toBeTruthy();
  });

  it('rejects files that match an exclude glob', () => {
    const matcher = new GlobMatcher([
      { uri: root, include: ['**/*'], exclude: ['**/node_modules/**/*'] },
    ]);

    expect(matcher.isMatch(root.joinPath('notes/a.md'))).toBeTruthy();
    expect(
      matcher.isMatch(root.joinPath('node_modules/pkg/a.md'))
    ).toBeFalsy();
  });

  it('rejects files that match no include glob', () => {
    const matcher = new GlobMatcher([
      { uri: root, include: ['notes/**'], exclude: [] },
    ]);

    expect(matcher.isMatch(root.joinPath('notes/a.md'))).toBeTruthy();
    expect(matcher.isMatch(root.joinPath('other/a.md'))).toBeFalsy();
  });

  /**
   * VS Code's `findFiles` returns files inside dot-directories, which is why
   * Foam has to exclude `**\/.foam/**` explicitly. A matcher that silently
   * dropped them would remove e.g. `.github/notes.md` from the index.
   */
  it('includes files inside dot-directories, as findFiles does', () => {
    const matcher = new GlobMatcher([
      { uri: root, include: ['**/*'], exclude: [] },
    ]);

    expect(matcher.isMatch(root.joinPath('.github/notes.md'))).toBeTruthy();
    expect(matcher.isMatch(root.joinPath('notes/.hidden.md'))).toBeTruthy();
  });

  it('excludes the .foam directory while keeping the rest of the workspace', () => {
    const matcher = new GlobMatcher([
      { uri: root, include: ['**/*'], exclude: ['**/.foam/**'] },
    ]);

    expect(
      matcher.isMatch(root.joinPath('.foam/templates/t.md'))
    ).toBeFalsy();
    expect(matcher.isMatch(root.joinPath('notes/a.md'))).toBeTruthy();
  });

  /**
   * `findFiles` follows the filesystem, so on Windows and default macOS an
   * exclude of `**\/Archive/**` also excludes a folder named `archive`.
   */
  it('matches case-insensitively', () => {
    const matcher = new GlobMatcher([
      { uri: root, include: ['**/*.md'], exclude: ['**/archive/**'] },
    ]);

    expect(matcher.isMatch(root.joinPath('Notes/A.MD'))).toBeTruthy();
    expect(matcher.isMatch(root.joinPath('docs/Archive/x.md'))).toBeFalsy();
  });

  it('supports brace alternates in globs', () => {
    const matcher = new GlobMatcher([
      { uri: root, include: ['**/*.{md,markdown}'], exclude: [] },
    ]);

    expect(matcher.isMatch(root.joinPath('a.md'))).toBeTruthy();
    expect(matcher.isMatch(root.joinPath('a.markdown'))).toBeTruthy();
    expect(matcher.isMatch(root.joinPath('a.txt'))).toBeFalsy();
  });

  it('applies each root its own include and exclude globs', () => {
    const notesRoot = URI.file('/notes-root');
    const docsRoot = URI.file('/docs-root');
    const matcher = new GlobMatcher([
      { uri: notesRoot, include: ['**/*'], exclude: ['**/private/**'] },
      { uri: docsRoot, include: ['published/**'], exclude: [] },
    ]);

    expect(matcher.isMatch(notesRoot.joinPath('a.md'))).toBeTruthy();
    expect(matcher.isMatch(notesRoot.joinPath('private/a.md'))).toBeFalsy();
    expect(matcher.isMatch(docsRoot.joinPath('published/a.md'))).toBeTruthy();
    expect(matcher.isMatch(docsRoot.joinPath('draft/a.md'))).toBeFalsy();
    // notes-root's permissive include must not leak into docs-root
    expect(matcher.isMatch(docsRoot.joinPath('a.md'))).toBeFalsy();
  });

  it('rejects a uri that belongs to no root', () => {
    const matcher = new GlobMatcher([
      { uri: root, include: ['**/*'], exclude: [] },
    ]);

    expect(matcher.isMatch(URI.file('/elsewhere/a.md'))).toBeFalsy();
  });

  it('does not treat a sibling root sharing a name prefix as a match', () => {
    const matcher = new GlobMatcher([
      { uri: URI.file('/vault'), include: ['**/*'], exclude: [] },
    ]);

    expect(matcher.isMatch(URI.file('/vault-backup/a.md'))).toBeFalsy();
  });

  it('filters a list of uris down to the matching ones', () => {
    const matcher = new GlobMatcher([
      { uri: root, include: ['**/*'], exclude: ['**/.foam/**'] },
    ]);

    const matched = matcher.match([
      root.joinPath('a.md'),
      root.joinPath('.foam/templates/t.md'),
      root.joinPath('b.md'),
    ]);

    expect(matched.map(u => u.path)).toEqual([
      '/workspace/a.md',
      '/workspace/b.md',
    ]);
  });

  it('answers without a refresh, because it holds no file list', async () => {
    const matcher = new GlobMatcher([
      { uri: root, include: ['**/*'], exclude: [] },
    ]);

    // A path that has never been listed still matches: there is no snapshot to
    // go stale. This is what makes it safe to check a file that was just moved.
    expect(matcher.isMatch(root.joinPath('brand/new/note.md'))).toBeTruthy();
    await matcher.refresh();
    expect(matcher.isMatch(root.joinPath('brand/new/note.md'))).toBeTruthy();
  });
});
