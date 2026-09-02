import { GlobMatcher as CoreGlobMatcher, URI } from '@foam/core';

/**
 * Single-root convenience wrapper over the shared {@link CoreGlobMatcher}, so
 * the CLI and the VS Code extension answer include/exclude the same way.
 */
export class GlobMatcher extends CoreGlobMatcher {
  constructor(
    include: string[] = ['**/*'],
    exclude: string[] = [],
    rootDir: URI
  ) {
    super([{ uri: rootDir, include, exclude }]);
  }
}
