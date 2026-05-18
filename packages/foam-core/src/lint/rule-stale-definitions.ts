import { LintIssue, LintRule } from './lint';
import { generateLinkReferences } from './generate-link-references';

export function staleDefinitionsRule(
  setting: 'withExtensions' | 'withoutExtensions'
): LintRule {
  return {
    id: 'stale-definitions',
    check(note, text, eol, workspace) {
      const edits = generateLinkReferences(
        note,
        text,
        eol,
        workspace,
        setting === 'withExtensions'
      );
      return edits.map(
        edit =>
          ({
            code: 'stale-definitions',
            message: 'Wikilink reference definitions are missing or outdated',
            range: edit.range,
            fix: [{ uri: note.uri, edit }],
          } satisfies LintIssue)
      );
    },
  };
}
