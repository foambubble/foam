/**
 * Parses a wikilink target into its note and fragment components.
 * @param wikilinkTarget The full string target of the wikilink (e.g., 'my-note#my-heading').
 * @returns An object containing the noteTarget and an optional fragment.
 */
export function parseWikilink(wikilinkTarget: string): {
  noteTarget: string;
  fragment?: string;
} {
  const [noteTarget, fragment] = wikilinkTarget.split('#');
  return { noteTarget, fragment };
}
