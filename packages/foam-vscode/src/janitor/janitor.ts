import { FoamWorkspace } from '../core/model/workspace';
import { Resource } from '../core/model/note';
import { LintIssue, TextEdit } from '../core/services/text-edit';
import { generateHeading, generateLinkReferences } from './index';

export type WikilinkDefinitionSetting = 'off' | 'withExtensions' | 'withoutExtensions';

/**
 * Checks a note for structural issues and returns them as LintIssues.
 * Each issue that can be auto-fixed carries a `fix` (a WorkspaceTextEdit).
 *
 * Current rules:
 * - missing-heading: note has no h1 section
 * - stale-definitions: wikilink reference definitions are missing or outdated
 */
export function lintNote(
  note: Resource,
  noteText: string,
  eol: string,
  workspace: FoamWorkspace,
  wikilinkSetting: WikilinkDefinitionSetting
): LintIssue[] {
  const issues: LintIssue[] = [];

  const headingEdit = generateHeading(note, noteText, eol);
  if (headingEdit) {
    issues.push({
      code: 'missing-heading',
      message: 'Note is missing an h1 heading',
      range: headingEdit.range,
      fix: [{ uri: note.uri, edit: headingEdit }],
    });
  }

  if (wikilinkSetting !== 'off') {
    const defEdits = generateLinkReferences(
      note,
      noteText,
      eol,
      workspace,
      wikilinkSetting === 'withExtensions' // false = withoutExtensions
    );
    for (const edit of defEdits) {
      issues.push({
        code: 'stale-definitions',
        message: 'Wikilink reference definitions are missing or outdated',
        range: edit.range,
        fix: [{ uri: note.uri, edit }],
      });
    }
  }

  return issues;
}

/**
 * Computes the raw TextEdits needed to bring a note into a clean state.
 * Used internally by the janitor command to apply all fixes at once.
 */
export function computeNoteEdits(
  note: Resource,
  noteText: string,
  eol: string,
  workspace: FoamWorkspace,
  wikilinkSetting: WikilinkDefinitionSetting
): TextEdit[] {
  return lintNote(note, noteText, eol, workspace, wikilinkSetting).flatMap(
    issue => issue.fix?.map(f => f.edit) ?? []
  );
}
