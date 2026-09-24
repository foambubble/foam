---
name: implement
description: Build what a spec describes, test first. Use when an @claude comment on a spec PR asks to implement it, with or without a plan.
allowed-tools: Bash(gh:*), Bash(git:*), Bash(yarn:*), Read, Write, Edit, Glob, Grep
---

# Implement a spec

Turn `specs/<slug>/spec.md` — and `plan.md` if the plan stage ran — into
working code on the same branch.

`AGENTS.md` carries the conventions and the testing rules; this skill is the
order of work.

## Rules

- **The failing tests come first**, and you run them and watch them fail
  before writing the code. Tests written alongside the code prove nothing.
- **Build the smallest thing that satisfies the acceptance criteria.** If the
  spec is missing something you need, say so rather than inventing scope.
- **Verify before reporting.** Run the suite and the linter, and paste what
  you ran.
- **Stay on the branch.** Never commit to `main`, and don't open a second PR.

## Steps

1. **Read the spec, and the plan if there is one.** No plan is fine — small
   work skips that stage deliberately. With a plan, follow it; where you
   depart from it, update `plan.md` in the same commit so the two never
   disagree.

2. **Write the failing tests.** Every acceptance criterion needs at least one,
   at the level it declares (`unit`, `e2e`), following the plan's verification
   map when there is one. A criterion often needs more than one case — the
   happy path and the edges it implies. Add ordinary unit tests for internals
   the criteria don't reach, and keep those separate from the ones that stand
   for a criterion, so the map stays readable.

   Run the suite and confirm each new test fails *for the reason its criterion
   describes* — a test failing on a typo proves nothing.

3. **Implement** until they pass, and keep the diff to what the criteria need.

4. **Run everything from the repo root**: `yarn test` and `yarn lint`, which
   Lerna runs across every package — a change to `@foam/core` breaks
   `foam-vscode` and `@foam/cli` without touching a file in either. Fix what
   you broke. While iterating, `yarn workspace <name> test:unit` is the fast
   loop, but it is not what you report.

5. **Consolidate before anyone else reads it.** Re-read the whole diff
   (`git diff origin/main...HEAD`) as one change rather than as the sequence
   you wrote it in, and tidy: drop scaffolding and debug leftovers, make
   naming match the code around it, collapse anything you wrote twice, and
   check the comments explain why rather than restating what. Confirm each
   criterion has a test that stands for it, and a user-visible change has
   its `docs/user/` update.

   This pass catches sloppiness, not bugs — you are the one who wrote the
   code, so you are the worst placed to find its logic errors. That is the
   reviewer's job, on a different model with the spec and no plan.

6. **Rewrite the PR description to describe the change**, not the spec that
   started it: what it does, how someone uses it, `Refs #<n>`, and anything
   left out. The body still written for the spec stage is stale the moment
   code lands, and it is the first thing a reviewer reads. Fix the title too
   if it names a stage rather than the feature — this repo squash-merges, so
   the title becomes the commit subject on `main`.

7. **Commit and push to the branch, then comment on the PR** so the work is
   reviewable without reading the diff cold. The comment carries: what you
   built, the test output, which tests stand for which criteria, anything in
   the spec you could not satisfy and why, and this block verbatim:

   > **Next:** review the diff, or reply here with changes.

8. **Mark the PR ready** — `gh pr ready <n>` — once the criteria are covered
   and the suite is green. Leaving draft is what says the implementation is
   done, and it triggers the review. If you could not satisfy a criterion,
   leave it as a draft and say what is missing instead.

   Locally, stop after the commit and say the branch is ready to push.
