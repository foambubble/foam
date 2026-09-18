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

5. **Add a changeset** if a published package changed. A `@foam/core` change
   also lists `foam-vscode` and `@foam/cli`.

6. **Commit and push to the branch, then comment on the PR** so the work is
   reviewable without reading the diff cold. The comment carries: what you
   built, the test output, which tests stand for which criteria, anything in
   the spec you could not satisfy and why, and this block verbatim:

   > **Next:** review the diff, or reply here with changes. Mark the PR ready
   > for review when it should get a full review pass.

   Locally, stop after the commit and say the branch is ready to push.
