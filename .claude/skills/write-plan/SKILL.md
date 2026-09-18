---
name: write-plan
description: Work out how to build what a spec describes, and write it to plan.md. Use when asked to plan a spec, or when an @claude comment on a spec PR asks for the plan.
allowed-tools: Bash(gh:*), Bash(git:*), Bash(yarn:*), Read, Write, Edit, Glob, Grep
---

# Write a plan

Work out how to build what `specs/<slug>/spec.md` describes, and write that
next to it as `specs/<slug>/plan.md`: how the change gets made, and which test
proves each acceptance criterion. The spec stays as it is.

The spec says what and why, and a reviewer reads it. The plan says how, and a
reviewer deliberately does not — so this is the place for approach, trade-offs
and the things you had to decide.

## Rules

- **No code.** Not even a first file. The plan is the artifact; implementation
  is a separate stage on the same branch.
- **Read before claiming.** Every file you name must exist and say what you
  think it says. A plan built on a guess costs more than no plan.
- **The conventions are in `AGENTS.md`** — reuse over parallel helpers, the
  domain/adapter split, URIs over path strings, changesets. The plan is where
  you show you've read them; don't restate them here.
- **Answer the spec's Open questions**, or say plainly which ones need the
  maintainer and stop. Don't quietly assume one and build on it.
- The spec is settled. If the work reveals the spec is wrong, say so in the
  plan and in your reply — don't silently widen the scope.

## Steps

1. **Locate the spec.** The active one is `specs/<slug>/` where `<slug>` is
   the current branch minus its type prefix. If the branch has no spec, say so
   and stop.

2. **Research.** Read the files the change will touch, the tests that cover
   them, and the nearest existing feature of the same shape.

3. **Settle the open questions.** For each one in the spec: answer it with a
   `file:line` citation, or mark it as needing the maintainer. Anything you
   assumed goes in the plan under its own heading, so a reviewer can see what
   you decided on their behalf.

4. **Write `specs/<slug>/plan.md`:**

   ```markdown
   # Plan: <title>

   ## Approach

   Two or three paragraphs. What changes, where, and why this way rather than
   the obvious alternative.

   ## Work breakdown

   1. ...
   2. ...

   ## AC verification map

   - AC-1 → `packages/foam-core/src/templates/variable-resolver.test.ts`
   - AC-8 → `packages/foam-vscode/src/vscode/features/notes/create-note.spec.ts`

   ## Decisions

   - <question from the spec> → <answer>, per `path/to/file.ts:42`

   ## Risks

   - What could break elsewhere, and what would catch it.
   ```

5. **Check the map covers the wiring, not just the logic.** A feature reached
   through more than one path (core and the VS Code adapter, say) can pass
   every unit test while one path was never hooked up. If no criterion covers
   that, say so in Risks and name the test that should.

6. **Commit** `specs/<slug>/plan.md` to the current branch:
   `git commit -m "Add plan for <title>"`.

7. **Hand it back.** Running in CI, push to the PR branch and comment on the
   thread — the plan is only useful if it gets read before the code exists.
   The comment carries the approach in a few sentences, the decisions you made
   on the maintainer's behalf, anything you need them to settle, and this
   block verbatim:

   > **Next:** comment `@claude implement` to build it, or reply here with
   > changes to the plan first.

   Locally, stop after the commit and say the branch is ready to push —
   `AGENTS.md` is clear that nothing leaves the machine unasked.
