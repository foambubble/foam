import { GlobPattern } from 'vscode';
/**
 * Expands simple brace alternates in a glob pattern, e.g.
 * 'ignoredFile{1,2}.txt' => ['ignoredFile1.txt', 'ignoredFile2.txt']
 */
export function expandAlternateGroups(pattern: string): GlobPattern[] {
  const match = pattern.match(/^(.*)\{([^{}]+)\}(.*)$/);
  if (!match) {
    return [pattern];
  }
  const [_, prefix, alternates, suffix] = match;
  return alternates
    .split(',')
    .flatMap(alt => expandAlternateGroups(`${prefix}${alt}${suffix}`));
}
