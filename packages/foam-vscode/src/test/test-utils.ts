/*
 * This file should not depend on VS Code as it's used for unit tests.
 *
 * The test utilities themselves live in `@foam/core/test`. We re-export
 * them here so existing imports keep working, and override the few values
 * that need to be foam-vscode-specific (e.g. TEST_DATA_DIR).
 */
import { URI } from '@foam/core';

export {
  InMemoryDataStore,
  strToUri,
  createTestWorkspace,
  createTestNote,
  createNoteFromMarkdown,
  wait,
  randomString,
  getRandomURI,
  readFileFromFs,
  waitForExpect,
} from '@foam/core/test';

/**
 * foam-vscode's test-data directory. This file is at `src/test/test-utils.ts`,
 * so test-data lives two levels up.
 */
export const TEST_DATA_DIR = URI.file(__dirname).joinPath(
  '..',
  '..',
  'test-data'
);
