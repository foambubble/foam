# CLAUDE.md

@AGENTS.md

The rest of this file is specific to Claude Code.

## Slash commands

Defined in `.claude/commands/`:

- `/research-issue <issue>` — researches a GitHub issue into `.agent/tasks/<issue>-<sanitized-title>.md`. Before working on an issue, check whether that file exists; if not, suggest running the command.
- `/prepare-pr` — PR title and description ready to paste, plus lint results and reviewer notes.
- `/update-changelog [package]` — drafts the changeset fragments missing for commits since the last release.
- `/review-docs [user|dev]` — audits the docs tree for stubs, stale content, and dangling references.

## Skills

Defined in `.claude/skills/`:

- `/write-spec <issue-number|problem statement>` — the spec procedure AGENTS.md points at. Given an issue it commits the spec on `<type>/<slug>`; given an idea it writes to `specs.local/` instead. It never pushes or opens a PR locally.

`.github/workflows/spec.yml` runs the same skill unattended when an issue is labelled `agent:spec` — there, and only there, it pushes the branch, opens a draft PR, and removes the label.

## Permissions

Bash calls are matched against the contributor's allowlist in `.claude/settings.local.json` (untracked). Simple single-purpose commands match; compound ones prompt — that's why AGENTS.md asks for simple commands. Introducing a new command shape (`cd && python`, `cd && cargo`)? Add it to the allowlist first.

## Working outside the main checkout

The Bash tool's CWD is always the main checkout, not wherever you last `cd`'d. To avoid a prompt per call:

- `git -C <path> <subcommand>` for git
- For yarn, in order of preference: `yarn workspace <package> <cmd>`, `yarn --cwd <path> <cmd>`, `cd <path> && yarn <cmd>`
- `cd <path> && npm <cmd>` for npm
- Don't mix `git -C` with `cd &&` in one command

`.agent/` scratch — plans and issue research — lives only in the main checkout, never in a worktree. Tracked specs under `specs/` are ordinary repo files and belong on the branch like any other change.

## Known quirk

`yarn test:e2e` launched from a Claude Code terminal can fail with `Cannot find module .../.test-workspace`: the extension host leaks `ELECTRON_RUN_AS_NODE=1`, so the spawned test VS Code runs as plain Node. Prefix the command with `env -u ELECTRON_RUN_AS_NODE`, or let the contributor run it from their own shell.
