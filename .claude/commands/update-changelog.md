# Update Changelog Command

Generate **changeset fragments** for commits not yet covered by an existing changeset. Changesets are the source of truth — `yarn version-packages` will later turn fragments into CHANGELOG entries and version bumps.

This command does NOT edit `CHANGELOG.md` and does NOT run `changeset version`.

## Usage

```
/update-changelog [package]
```

## Parameters

- `package` (optional): The package whose commits to scan — one of `foam-vscode`, `@foam/cli`, `@foam/core`. Use the workspace name exactly as it appears in the package's `package.json` `name` field (this is what changesets requires in fragment frontmatter). Note: `@foam/cli` is republished to npm under the name `foam-cli`, but for changesets always use the workspace name `@foam/cli`. **If omitted, scan all three packages and produce fragments for each.**

## Description

This command:

0. If no `package` argument is given, run the steps below for each of `foam-vscode`, `@foam/cli`, `@foam/core` and produce a single combined summary at the end.
1. Identifies the last release tag for the target package. Conventions in this repo (per-package tags, unprefixed):
   - `foam-vscode` → tags matching `vscode@*` (e.g. `vscode@0.40.3`)
   - `@foam/cli` → tags matching `cli@*` (e.g. `cli@0.40.3`)
   - `@foam/core` → tags matching `core@*` (e.g. `core@0.40.3`)
   - If no per-package tag exists yet, fall back to the most recent unprefixed `v*` tag (legacy convention) or ask the developer.
2. Lists commits between that tag and `HEAD` that touched files relevant to the package:
   - For `foam-vscode`: `packages/foam-vscode/**`
   - For `@foam/cli`: `packages/foam-cli/**`
   - For `@foam/core`: `packages/foam-core/**`
   - A commit may be relevant to multiple packages (e.g. a core change that the extension consumes) — surface it for each.
3. Reads existing pending fragments in `.changeset/*.md` (excluding `README.md` and `config.json`). Each fragment's frontmatter declares which packages it bumps; treat a commit as "covered" if a pending fragment plausibly describes it.
4. For commits **not** covered, drafts new fragments and writes them to `.changeset/`.
5. Prints a summary: covered commits, newly drafted fragments, commits intentionally skipped (with reason).

## Fragment format

Each new fragment is a separate file in `.changeset/`. Use a short kebab-case filename derived from the change (e.g. `.changeset/fix-symlink-watcher.md`). Frontmatter lists packages and bump type; body is the user-facing entry.

```markdown
---
'foam-vscode': patch
---

Fix symlink support by augmenting file watcher with `onDidSaveTextDocument` (#1630)
```

Whether a commit needs a fragment, which bump, the `@foam/core` cascade, and how to write the entry all follow the [changelog rules](../../docs/dev/releasing-foam.md#changelog-rules). Keep entries short: what changed for the user, not why or how. If a commit message is ambiguous, look at the diff or linked PR for intent.

## Constraints

- Do NOT commit anything — leave fragments for the developer to review
- Do NOT run `yarn version-packages` or `changeset version`
- Do NOT edit `CHANGELOG.md` directly
- Do NOT invent issue numbers or contributor names — check `gh pr view` / `gh issue view` if a PR is referenced in the commit message
- Group trivial commits (typo fixes, minor refactors in the same area) into one fragment rather than padding
- If a commit is too low-level to summarise meaningfully (e.g. "wip", "fix lint"), skip it and report it in the summary
- If you are unsure whether a pending fragment already covers a commit, ask the developer rather than writing a duplicate
