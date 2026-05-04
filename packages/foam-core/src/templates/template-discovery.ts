import path from 'node:path';
import { URI } from '../model/uri';

/**
 * Returns the URI for the .foam/templates directory within a workspace root.
 */
export function getTemplatesDir(rootDir: string): URI {
  return URI.file(path.join(rootDir, '.foam', 'templates'));
}

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

/**
 * Gets the candidate URIs for the new-note template given a templates directory.
 */
export function getNewNoteTemplateCandidateUris(templatesDir: URI): URI[] {
  return [
    templatesDir.joinPath('new-note.js'),
    templatesDir.joinPath('new-note.md'),
  ];
}
