import { URI } from '../model/uri';
import { Config } from '../config';

/**
 * Returns the URI for the templates directory within a workspace root.
 *
 * The folder is read from `foam.templates.folder` (default `.foam/templates`).
 * The configured value may contain `/` separators for nested paths.
 *
 * The result is derived from {@link rootUri} via `joinPath`, so it inherits
 * the workspace root's scheme/authority — safe for both Node and browser
 * (web extension) builds.
 */
export function getTemplatesDir(rootUri: URI): URI {
  const folder = Config.getTemplatesFolder();
  return rootUri.joinPath(...folder.split('/'));
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

/**
 * Finds a default template (new-note, daily-note...) across several templates
 * directories — one per workspace root, in root order. The first directory
 * that has any candidate wins, so a root earlier in the list always takes
 * precedence over a later one, whatever the candidates' extensions.
 */
export async function findFirstTemplate(
  templatesDirs: URI[],
  candidatesFor: (templatesDir: URI) => URI[],
  exists: (uri: URI) => Promise<boolean>
): Promise<URI | undefined> {
  for (const templatesDir of templatesDirs) {
    for (const candidate of candidatesFor(templatesDir)) {
      if (await exists(candidate)) {
        return candidate;
      }
    }
  }
  return undefined;
}
