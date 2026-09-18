# Specs

A spec says **what** we are building and **how we will know it works**. It is
written before the code exists, reviewed like code, and kept after the work
ships.

## Layout

```
specs/<slug>/
  spec.md    what and why: context, acceptance criteria, out of scope
  plan.md    how: approach, work breakdown  (only when the work needs one)
```

`<slug>` matches the branch name minus its type prefix, so
`feature/1712-daily-note-previous-link` uses
`specs/1712-daily-note-previous-link/`. A spec that came from an issue is
prefixed with its number; one that came from an idea is not. Slugs are unique
across the repo and never change once the spec exists.

**The active spec is the one matching the current branch.** There is no index
file to keep in sync; the cross-feature view is `gh pr list`.

## Two tiers

- `specs/` is tracked. Work that is going to happen.
- `specs.local/` is gitignored, same layout. Exploration that has not
  graduated, and thinking that may never leave your machine. Promote a spec by
  copying it into `specs/`.

## The flow

Each feature is one branch and one pull request, from spec to merge. Stages
are started by adding an `agent:<stage>` label, and the label is removed when
the stage finishes, so re-adding it re-runs that stage. Use an `@claude`
comment to steer within a stage.

1. `agent:spec` on the issue → a draft PR containing `spec.md`
2. `agent:plan` on the PR → `plan.md` (skip it when the work is small)
3. `agent:implement` on the PR → a failing test, then the change
4. Review, then merge

Because a spec only reaches `main` when its feature merges, everything under
`specs/` in `main` is finished work. In-progress specs live on their branch.
Nothing needs archiving.

## Does this need a spec?

Ask: *would I want acceptance criteria written down before the code exists?*

A bug with an obvious fix does not need one — the failing test says everything
a spec would. A change to user-visible behaviour usually does.

## Writing acceptance criteria

Use Given-When-Then, and say how each criterion is verified — `unit`, `e2e` or
`human`:

```markdown
- **AC-1**: Given a daily note for Monday and no note for Sunday, when the
  daily note for Tuesday is created, then the previous-note link points at
  Monday's note.
  _verify: unit_
```

A declared verification is a promise, not an aspiration. CI runs the whole
`foam-vscode` suite, unit and e2e, on every pull request, so `e2e` is fair to
declare. `human` means somebody looks at it before merge, and is a promise to
the same standard.

Keep solution approaches out of `spec.md`. They belong in `plan.md`, which the
code reviewer deliberately does not read — a reviewer who knows the intended
approach checks whether the code matches the plan, when the job is to check
whether the code is right.

If a spec passes roughly ten acceptance criteria, propose splitting it. Review
effort grows faster than diff size.
