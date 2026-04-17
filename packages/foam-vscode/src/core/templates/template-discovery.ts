import { URI } from '../model/uri';

/**
 * Gets the candidate URIs for the daily note template given a templates directory.
 * Pure function — no VS Code dependency.
 */
export function getDailyNoteTemplateCandidateUris(templatesDir: URI): URI[] {
  return [
    templatesDir.joinPath('daily-note.js'),
    templatesDir.joinPath('daily-note.md'),
  ];
}
