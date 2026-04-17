import detectNewline from 'detect-newline';
import { FoamWorkspace } from '../core/model/workspace';
import { Resource } from '../core/model/note';
import { Range } from '../core/model/range';
import { URI } from '../core/model/uri';
import { TextEdit, WorkspaceTextEdit } from '../core/services/text-edit';
import { ProgressCallback } from '../core/services/progress';
import { missingHeadingRule } from './rule-missing-heading';
import { staleDefinitionsRule } from './rule-stale-definitions';

export { missingHeadingRule } from './rule-missing-heading';
export { staleDefinitionsRule } from './rule-stale-definitions';

/** A platform-agnostic pointer to a related location, used for hints in lint issues. */
export interface LintRelatedInfo {
  uri: URI;
  range: Range;
  message: string;
}

/**
 * A lint issue found in a note, modelled after ESLint's rule output.
 *
 * Every issue has a code, a human-readable message, and the range in the
 * source file where the problem is. Issues that can be fixed automatically
 * carry a `fix` — an array of workspace edits (may span multiple files).
 * Issues without a `fix` require human judgment to resolve.
 *
 * `relatedInfo` carries optional hints (e.g. candidate targets for an
 * ambiguous link) that a VS Code adapter can surface as DiagnosticRelatedInformation.
 */
export interface LintIssue {
  /** Machine-readable identifier, e.g. 'missing-heading', 'ambiguous-identifier' */
  code: string;
  message: string;
  range: Range;
  /** Present when the issue can be fixed automatically. May touch multiple files. */
  fix?: WorkspaceTextEdit[];
  /** Optional hints pointing to related locations (e.g. candidate targets). */
  relatedInfo?: LintRelatedInfo[];
}

export type WikilinkDefinitionSetting = 'off' | 'withExtensions' | 'withoutExtensions';

export interface LintRule {
  readonly id: string;
  check(
    note: Resource,
    text: string,
    eol: string,
    workspace: FoamWorkspace
  ): LintIssue[];
}

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
  const rules: LintRule[] = [missingHeadingRule()];
  if (wikilinkSetting !== 'off') {
    rules.push(staleDefinitionsRule(wikilinkSetting));
  }
  return rules.flatMap(rule => rule.check(note, noteText, eol, workspace));
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

/**
 * The result of linting a workspace. Provides URI-native lookup over
 * the set of notes that have issues; clean notes are omitted.
 */
export class WorkspaceLintResult {
  readonly entries: ReadonlyArray<{ uri: URI; issues: LintIssue[] }>;
  private readonly index: Map<string, LintIssue[]>;

  constructor(entries: { uri: URI; issues: LintIssue[] }[]) {
    this.entries = entries;
    this.index = new Map(entries.map(e => [e.uri.toString(), e.issues]));
  }

  get(uri: URI): LintIssue[] | undefined {
    return this.index.get(uri.toString());
  }

  has(uri: URI): boolean {
    return this.index.has(uri.toString());
  }
}

/**
 * Lints all markdown notes in the workspace using the given rules.
 * Returns one entry per note that has at least one issue; clean notes are omitted.
 */
export async function lintWorkspace(
  workspace: FoamWorkspace,
  rules: LintRule[],
  progress?: ProgressCallback<Resource>
): Promise<WorkspaceLintResult> {
  const entries: { uri: URI; issues: LintIssue[] }[] = [];
  const notes = workspace.list().filter(r => r.uri.isMarkdown());
  const total = notes.length;

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    progress?.({ current: i + 1, total, context: note });

    const text = await workspace.readAsMarkdown(note.uri);
    if (text == null) continue;

    const eol = detectNewline(text) ?? '\n';
    const issues = rules.flatMap(rule => rule.check(note, text, eol, workspace));
    if (issues.length > 0) {
      entries.push({ uri: note.uri, issues });
    }
  }

  return new WorkspaceLintResult(entries);
}
