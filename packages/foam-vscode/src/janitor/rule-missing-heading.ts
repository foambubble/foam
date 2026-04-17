import { LintIssue, LintRule } from './janitor';
import { generateHeading } from './generate-headings';

export function missingHeadingRule(): LintRule {
  return {
    id: 'missing-heading',
    check(note, text, eol, _workspace) {
      const edit = generateHeading(note, text, eol);
      if (!edit) return [];
      return [
        {
          code: 'missing-heading',
          message: 'Note is missing an h1 heading',
          range: edit.range,
          fix: [{ uri: note.uri, edit }],
        } satisfies LintIssue,
      ];
    },
  };
}
