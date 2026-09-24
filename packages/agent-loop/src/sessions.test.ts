import { describe, expect, it } from 'vitest';
import { REVIEW_DIFF } from './briefs.ts';
import { CoderResultSchema } from './contracts.ts';
import { coderRefusal, outputSchema, readResult, reviewerRefusal } from './sessions.ts';

const bash = (command: string) => reviewerRefusal('Bash', { command });

describe('reviewerRefusal', () => {
  it('refuses to read a plan through any file tool', () => {
    expect(reviewerRefusal('Read', { file_path: '/repo/specs/demo/plan.md' })).toMatch(/plan/);
    expect(reviewerRefusal('Grep', { pattern: 'x', path: 'specs/demo/plan.md' })).toMatch(/plan/);
    expect(reviewerRefusal('Glob', { pattern: '**/plan.md' })).toMatch(/plan/);
  });

  it("refuses the loop's own record, which holds the review history", () => {
    expect(reviewerRefusal('Read', { file_path: '/repo/.agent-loop/demo/run/round-1/reviewer.json' })).toMatch(/record/);
    expect(reviewerRefusal('Glob', { pattern: '.agent-loop/**/*.json' })).toMatch(/record/);
    expect(bash('git status --ignored .agent-loop')).toMatch(/record/);
  });

  it('allows reading the spec and the code', () => {
    expect(reviewerRefusal('Read', { file_path: '/repo/specs/demo/spec.md' })).toBeNull();
    expect(reviewerRefusal('Grep', { pattern: 'runLoop', path: 'packages' })).toBeNull();
  });

  it('allows the review diff it is told to run', () => {
    expect(bash(REVIEW_DIFF)).toBeNull();
    expect(bash(`git show HEAD -- . ':!specs/**/plan.md'`)).toBeNull();
  });

  it('refuses a patch that could include the plan', () => {
    expect(bash('git diff origin/main...HEAD')).toMatch(/plan\.md/);
    expect(bash('git show HEAD~1')).toMatch(/plan\.md/);
    expect(bash('git log -p')).toMatch(/plan\.md/);
    expect(bash(`git diff -- . ':!specs/demo/plan.md'`)).toMatch(/plan/);
  });

  it('allows a patch limited to paths that cannot hold a plan', () => {
    expect(bash('git diff origin/main...HEAD -- packages/foam-core .changeset docs')).toBeNull();
    expect(bash('git show HEAD:docs/dev/releasing-foam.md')).toBeNull();
  });

  it('refuses a patch limited to paths that could hold a plan', () => {
    expect(bash('git diff origin/main...HEAD -- specs')).toMatch(/plan\.md/);
    expect(bash('git diff origin/main...HEAD -- . packages')).toMatch(/plan\.md/);
    expect(bash("git diff origin/main...HEAD -- '*.md'")).toMatch(/plan\.md/);
    expect(bash('git diff origin/main...HEAD -- packages/..')).toMatch(/plan\.md/);
  });

  it('allows history and summaries that carry no patch', () => {
    expect(bash('git log --oneline origin/main..HEAD')).toBeNull();
    expect(bash('git diff --stat origin/main...HEAD')).toBeNull();
  });

  it('refuses naming the plan in a command', () => {
    expect(bash('git show HEAD:specs/demo/plan.md')).toMatch(/plan/);
  });

  it('refuses anything but read-only git, and any chaining or redirection', () => {
    expect(bash('cat specs/demo/spec.md')).not.toBeNull();
    expect(bash('git commit -m x')).not.toBeNull();
    expect(bash(`${REVIEW_DIFF} > out.txt`)).not.toBeNull();
    expect(bash(`${REVIEW_DIFF} && cat x`)).not.toBeNull();
    expect(bash(`git log $(echo x)`)).not.toBeNull();
  });

  it('allows piping into a filter, but not one that reads files', () => {
    expect(bash(`${REVIEW_DIFF} | head -50`)).toBeNull();
    expect(bash(`git log --oneline | grep -r fix .`)).not.toBeNull();
  });
});

describe('coderRefusal', () => {
  it('refuses pushing and GitHub', () => {
    expect(coderRefusal('Bash', { command: 'git push' })).not.toBeNull();
    expect(coderRefusal('Bash', { command: 'git push -u origin feature/x' })).not.toBeNull();
    expect(coderRefusal('Bash', { command: 'gh pr ready 12' })).not.toBeNull();
    expect(coderRefusal('Bash', { command: 'git -C packages/foam-core push' })).not.toBeNull();
    expect(coderRefusal('Bash', { command: 'yarn lint && git push' })).not.toBeNull();
  });

  it('judges the command, not the words in its arguments', () => {
    expect(coderRefusal('Bash', { command: 'git commit -m "Stop the push from failing"' })).toBeNull();
    expect(coderRefusal('Bash', { command: 'git commit -m "Document the gh workflow"' })).toBeNull();
  });

  it('allows the work itself', () => {
    expect(coderRefusal('Bash', { command: 'git commit -m "Add the thing"' })).toBeNull();
    expect(coderRefusal('Bash', { command: 'yarn test' })).toBeNull();
    expect(coderRefusal('Bash', { command: 'git log --grep push' })).toBeNull();
    expect(coderRefusal('Edit', { file_path: 'src/a.ts' })).toBeNull();
  });
});

describe('outputSchema', () => {
  it('declares JSON Schema draft-07, which the Claude Code process validates against', () => {
    expect(outputSchema(CoderResultSchema).$schema).toBe('http://json-schema.org/draft-07/schema#');
  });
});

describe('readResult', () => {
  const result = { type: 'result', num_turns: 3, total_cost_usd: 0.5, errors: [] } as const;

  it("returns a successful session's structured output and cost", () => {
    const message = { ...result, subtype: 'success', is_error: false, result: '', structured_output: { ok: true } };
    expect(readResult(message as never)).toEqual({ output: { ok: true }, costUsd: 0.5 });
  });

  it('fails with the reason a session reported, even when flagged as a success', () => {
    const message = {
      ...result,
      subtype: 'success',
      is_error: true,
      result: 'Failed to authenticate: OAuth session expired and could not be refreshed',
    };
    expect(() => readResult(message as never)).toThrow(/Failed to authenticate/);
  });

  it('fails with the errors of a session that did not finish', () => {
    const message = { ...result, subtype: 'error_max_turns', is_error: true, errors: ['too many turns'] };
    expect(() => readResult(message as never)).toThrow(/error_max_turns.*too many turns/);
  });
});
