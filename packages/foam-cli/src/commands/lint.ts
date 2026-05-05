import fs from 'node:fs/promises';
import path from 'node:path';
import { TextEdit } from '@foam/core';
import {
  parseArgs,
  getString,
  getStrings,
  getFlag,
  resolveWorkspaceDir,
} from '../support/args';
import type { CliLogger, Format } from '../support/types';
import { loadWorkspaceFromDirectory } from '../support/filesystem';
import { uriToWorkspacePath } from '../support/workspace';
import {
  lintWorkspace,
  missingHeadingRule,
  staleDefinitionsRule,
  type LintIssue,
  type LintRule,
} from '@foam/core';
import { bold, dim, path as pathColor, warning } from '../support/colors';

// ─── Help ─────────────────────────────────────────────────────────────────────

export const LINT_HELP = `Usage: foam lint [options]

Check workspace notes for issues.

Options:
  --fix              Apply all auto-fixable issues
  --rule <id>        Run only the given rule (repeatable)
                     Rules: missing-heading, stale-definitions
  --workspace <dir>  Workspace root (default: FOAM_WORKSPACE env var, then cwd)
  --format <fmt>     text (default) or json
  --help             Show this help

Exit codes:
  0  No issues found
  2  Issues found (CI-friendly: foam lint || echo "issues found")
  1  Command error
`;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LintResult {
  uri: string;
  path: string;
  issues: Array<{
    code: string;
    message: string;
    line: number;
    column: number;
    fixable: boolean;
  }>;
}

// ─── Domain ───────────────────────────────────────────────────────────────────

const ALL_RULES = ['missing-heading', 'stale-definitions'] as const;

export function buildRules(ruleFilter: string[]): LintRule[] {
  const active = ruleFilter.length === 0 ? [...ALL_RULES] : ruleFilter;
  const rules: LintRule[] = [];
  if (active.includes('missing-heading')) rules.push(missingHeadingRule());
  if (active.includes('stale-definitions')) rules.push(staleDefinitionsRule('withoutExtensions'));
  return rules;
}

// ─── Formatting ───────────────────────────────────────────────────────────────

export function formatLintText(results: LintResult[]): string {
  if (results.length === 0) return '';

  const lines: string[] = [];
  let totalErrors = 0;
  let totalWarnings = 0;
  let totalFixable = 0;

  for (const result of results) {
    lines.push(pathColor(result.path));
    for (const issue of result.issues) {
      const fixNote = issue.fixable ? dim(' (fixable)') : '';
      lines.push(
        `  ${dim(`${issue.line}:${issue.column}`)}  ${warning('warning')}  ${issue.message}${fixNote}  ${dim(issue.code)}`
      );
      totalWarnings++;
      if (issue.fixable) totalFixable++;
    }
  }

  const total = totalErrors + totalWarnings;
  const head = `${total} problem${total === 1 ? '' : 's'}`;
  const breakdown = [
    `(${totalErrors} error${totalErrors === 1 ? '' : 's'}, ${totalWarnings} warning${totalWarnings === 1 ? '' : 's'}`,
    totalFixable > 0 ? `, ${totalFixable} fixable with --fix)` : `)`,
  ].join(' ');

  lines.push('');
  lines.push(`${total > 0 ? bold(head) : head} ${breakdown}`);
  return lines.join('\n');
}

// ─── Command runner ───────────────────────────────────────────────────────────

export async function runLintCommand(
  argv: string[],
  logger: CliLogger
): Promise<number> {
  const [first] = argv;

  if (first === '--help' || first === '-h') {
    logger.info(LINT_HELP);
    return 0;
  }

  const parsed = parseArgs(argv);

  if (getFlag(parsed, 'help')) {
    logger.info(LINT_HELP);
    return 0;
  }

  const format: Format = (getString(parsed, 'format') as Format) ?? 'text';
  const workspaceDir = resolveWorkspaceDir(parsed);
  const fix = getFlag(parsed, 'fix');
  const ruleFilter = getStrings(parsed, 'rule');

  const unknownRules = ruleFilter.filter(r => !ALL_RULES.includes(r as any));
  if (unknownRules.length > 0) {
    logger.error(`Unknown rule(s): ${unknownRules.join(', ')}. Valid rules: ${ALL_RULES.join(', ')}`);
    return 1;
  }

  try {
    const { rootDir, workspace } = await loadWorkspaceFromDirectory(workspaceDir);
    const rules = buildRules(ruleFilter);
    const lintResult = await lintWorkspace(workspace, rules);

    const results: LintResult[] = lintResult.entries.map(({ uri, issues }) => ({
      uri: uri.toFsPath(),
      path: uriToWorkspacePath(uri, rootDir),
      issues: issues.map((issue: LintIssue) => ({
        code: issue.code,
        message: issue.message,
        line: issue.range.start.line + 1,
        column: issue.range.start.character + 1,
        fixable: Boolean(issue.fix && issue.fix.length > 0),
      })),
    }));

    if (fix) {
      let fixedCount = 0;
      for (const { uri, issues } of lintResult.entries) {
        const fixableIssues = issues.filter(i => i.fix && i.fix.length > 0);
        if (fixableIssues.length === 0) continue;

        const noteText = await workspace.readAsMarkdown(uri);
        if (noteText == null) continue;

        const edits = fixableIssues.flatMap(i => i.fix!.map(f => f.edit));
        const updatedText = TextEdit.apply(noteText, edits);
        await fs.writeFile(uri.toFsPath(), updatedText, 'utf8');
        fixedCount += fixableIssues.length;
      }

      if (format === 'text') {
        if (fixedCount > 0) {
          logger.info(`Fixed ${fixedCount} issue${fixedCount === 1 ? '' : 's'}.`);
        } else {
          logger.info('No fixable issues found.');
        }
      } else {
        logger.info(JSON.stringify({ fixed: fixedCount }, null, 2));
      }
      return 0;
    }

    if (results.length === 0) {
      if (format === 'text') {
        // No output on clean — consistent with ESLint
      } else {
        logger.info(JSON.stringify([], null, 2));
      }
      return 0;
    }

    if (format === 'json') {
      logger.info(JSON.stringify(results, null, 2));
    } else {
      logger.info(formatLintText(results));
    }

    return 2;
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
}
