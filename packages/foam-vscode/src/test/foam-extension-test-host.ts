/**
 * Activates Foam features into the unit test (vscode-mock) environment.
 *
 * Call initializeFoamFeatures() once from the global Vitest setup so all
 * feature commands are registered before any test runs.
 * vscode-mock.ts stays a pure VS Code API stub with no Foam-specific logic.
 */
import { Foam, Logger } from '@foam/core';
import { createMockExtensionContext } from './vscode-mock';

import dailyNotes from '../vscode/features/daily-notes';
import editing from '../vscode/features/editing';
import navigation from '../vscode/features/navigation';
import notes from '../vscode/features/notes';
import tags from '../vscode/features/tags';
import janitor from '../vscode/features/janitor';

export async function initializeFoamFeatures(foam: Foam): Promise<void> {
  const context = createMockExtensionContext();
  const foamPromise = Promise.resolve(foam);

  await dailyNotes(context, foamPromise);
  await editing(context, foamPromise);
  await navigation(context, foamPromise);
  await notes(context, foamPromise);
  await tags(context, foamPromise);
  await janitor(context, foamPromise);
  // AI features require embeddings which are not available in the mock environment

  Logger.info('Foam features initialized in mock environment');
}
