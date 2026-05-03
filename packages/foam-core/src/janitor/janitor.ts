import detectNewline from 'detect-newline';
import { FoamWorkspace } from '../model/workspace';
import { Resource } from '../model/note';
import { Range } from '../model/range';
import { URI } from '../model/uri';
import { TextEdit, WorkspaceTextEdit } from '../services/text-edit';
import { ProgressCallback } from '../services/progress';
import { missingHeadingRule } from './rule-missing-heading';
import { staleDefinitionsRule } from './rule-stale-definitions';

export { missingHeadingRule } from './rule-missing-heading';
export { staleDefinitionsRule } from './rule-stale-definitions';

export interface LintRelatedInfo {
  uri: URI;
  range: Range;
  message: string;
}

export interface LintIssue {
  code: string;
  message: string;
  range: Range;
  fix?: WorkspaceTextEdit[];
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
