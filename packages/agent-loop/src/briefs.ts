import { BLOCKING_TIER } from './contracts.ts';
import type { Finding, Outcome } from './loop.ts';

/** The diff every reviewer reads: the whole branch, minus the plan. */
export const REVIEW_DIFF = `git diff origin/main...HEAD -- . ':!specs/**/plan.md'`;

interface SpecPaths {
  specDir: string;
  planFile: string | null;
}

function specLines({ specDir, planFile }: SpecPaths): string[] {
  return [
    `The spec is ${specDir}/spec.md.`,
    ...(planFile ? [`The plan is ${planFile}. The reviewer cannot read it; you should.`] : []),
  ];
}

function findingsBlock(findings: Finding[]): string[] {
  const shown = findings.map(({ id, source, tier, path, line, finding, detail }) => ({
    id,
    from: source,
    ...(tier ? { tier } : {}),
    ...(path ? { path } : {}),
    ...(line ? { line } : {}),
    finding,
    ...(detail ? { detail } : {}),
  }));
  return ['```json', JSON.stringify(shown, null, 2), '```'];
}

const ADDRESSING = [
  `Every finding ends as fixed or rejected, with a reason. Rejecting one is a`,
  `legitimate answer, because a finding can be wrong or ask for something the`,
  `spec puts out of scope. Skipping one is not: an unanswered finding is shown`,
  `to the maintainer as open. A finding from the maintainer carries their`,
  `authority, so reject one only when following it would break the spec, and`,
  `say so.`,
  ``,
  `A finding about behaviour gets a failing test first, watched failing, then`,
  `the fix. A finding about naming, a comment or a document does not: do not`,
  `write a test asserting that a comment exists. Never answer a finding by`,
  `weakening the test that exposed it. If the expectation is right, the code`,
  `is wrong.`,
  ``,
  `${BLOCKING_TIER} findings are what keep this loop running, so they come`,
  `first. SHOULD and NIT are worth fixing when the fix is small and certain.`,
  `Fix what a finding names and nothing more: it is not an opening to`,
  `refactor the file it landed in.`,
];

function closing(hasFindings: boolean): string[] {
  return [
    `Commit your work on the current branch. Do not push, and do not touch the`,
    `pull request: the loop owns both. Run \`yarn test\` and \`yarn lint\` from`,
    `the repo root before you finish. The loop runs them again after you, and`,
    `red work comes straight back to you without a review.`,
    ``,
    `Return:`,
    hasFindings
      ? `- outcomes: one entry per finding above, by its id.`
      : `- outcomes: an empty list. There were no findings this round.`,
    `- blocked: true when you need the maintainer's judgment, or when the work`,
    `  would change an acceptance criterion. Say why in summary.`,
    `- summary: one paragraph on what you did.`,
  ];
}

export function coderFirstBrief({
  rounds,
  instructions,
  findings,
  ...paths
}: SpecPaths & { rounds: number; instructions?: string; findings: Finding[] }): string {
  return [
    `You are the coder in an implement and review loop, round 1 of up to ${rounds}.`,
    `After you finish, the test suite runs, and then a separate reviewer reads`,
    `the branch against the spec without seeing how you meant to build it.`,
    ``,
    ...specLines(paths),
    ``,
    `Implement the spec by following steps 1 to 5 of`,
    `.claude/skills/implement/SKILL.md: the failing tests first, watched failing,`,
    `then the smallest change that satisfies the acceptance criteria, the whole`,
    `suite, and a consolidation pass over the whole diff. Steps 6 to 8 are not`,
    `yours.`,
    ...(instructions
      ? [``, `The maintainer's instructions for this run, verbatim:`, ``, '<<<', instructions, '>>>']
      : []),
    ...(findings.length > 0
      ? [``, `Answer these findings from the maintainer too:`, ``, ...findingsBlock(findings), ``, ...ADDRESSING]
      : []),
    ``,
    ...closing(findings.length > 0),
  ].join('\n');
}

export function coderNextBrief({
  round,
  rounds,
  findings,
  ...paths
}: SpecPaths & { round: number; rounds: number; findings: Finding[] }): string {
  return [
    `You are the coder in an implement and review loop, round ${round} of up to ${rounds}.`,
    ``,
    ...specLines(paths),
    ``,
    `Answer these findings. They come from a reviewer who read the branch`,
    `against the spec without seeing how you meant to build it, from the test`,
    `suite, and from the maintainer:`,
    ``,
    ...findingsBlock(findings),
    ``,
    ...ADDRESSING,
    ``,
    ...closing(true),
  ].join('\n');
}

function reviewRules(specDir: string): string[] {
  return [
    `Read the diff with:`,
    ``,
    `  ${REVIEW_DIFF}`,
    ``,
    `and add the same \`-- . ':!specs/**/plan.md'\` to any \`git show\` or`,
    `\`git log -p\`. Do not read specs/**/plan.md by any route; attempts are`,
    `refused. Knowing the intended approach makes you check whether the code`,
    `matches the plan, when the job is to check whether the code is right.`,
    ``,
    `Read ${specDir}/spec.md first. The change has to satisfy its acceptance`,
    `criteria, and each criterion needs a test that stands for it: a missing`,
    `test, or one asserting something weaker than the criterion, is a finding`,
    `in itself. Read AGENTS.md for the conventions this repo holds code to.`,
    ``,
    `Also report a user-visible change with nothing added under docs/user/,`,
    `and documentation that explains the implementation rather than showing`,
    `someone how to use the feature.`,
    ``,
    `Tier each finding. Reserve ${BLOCKING_TIER} for broken behaviour, a missing`,
    `or weakened test for an acceptance criterion, a leak, or a breach of the`,
    `repo's conventions. Everything else is SHOULD or NIT. An empty list is a`,
    `valid answer. Say nothing you would not say to the author's face, and`,
    `nothing you only half believe.`,
    ``,
    `Report findings only. Do not change any file.`,
  ];
}

export function reviewerBrief({
  round,
  specDir,
  previous,
}: {
  round: number;
  specDir: string;
  previous: (Finding & { outcome?: Outcome })[];
}): string {
  const lines = [
    `Review the change on this branch as a reviewer who did not write it.`,
    `The build, lint and full test suite already passed on this commit, so`,
    `don't run them: read.`,
    ``,
    ...reviewRules(specDir),
  ];
  if (round > 1 && previous.length > 0) {
    lines.push(
      ``,
      `This is round ${round}. These are the findings you reported last time,`,
      `with the coder's answer to each where there is one:`,
      ``,
      '```json',
      JSON.stringify(
        previous.map(({ id, tier, path, finding, outcome }) => ({ id, tier, path, finding, answer: outcome ?? null })),
        null,
        2
      ),
      '```',
      ``,
      `Report on whether those answers hold: a rejection you still disagree`,
      `with, or a fix that does not fix, stays a finding. Report any regression`,
      `the fixes introduced on the lines they touched. Do not open new lines of`,
      `inquiry elsewhere in the diff, and do not repeat a finding that was fixed.`
    );
  }
  return lines.join('\n');
}

export function coldBrief({ specDir }: { specDir: string }): string {
  return [
    `Review the change on this branch end to end. You are the last reader`,
    `before the maintainer, and you are seeing it for the first time: on`,
    `purpose, you have no record of how it was reviewed so far. Your findings`,
    `go to the maintainer, not to the author.`,
    ``,
    ...reviewRules(specDir),
  ].join('\n');
}
