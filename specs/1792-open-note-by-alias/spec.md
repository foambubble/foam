---
issue: 1792
type: feature
created: 2026-11-25
---

# Open a note by its alias

## Context

Notes can declare `alias` in their frontmatter, and those aliases are how some
people think of a note — the title is `Einstein, Albert`, but they look for
`Einstein`. Today the only way to reach a note by alias is **Go to Symbol in
Workspace** (`Ctrl+T`), added in #1461. The reporter of
[#1792](https://github.com/foambubble/foam/issues/1792) finds that slow and
noisy on a large workspace: `Ctrl+T` collects symbols from every provider, so
alias hits arrive mixed in with headings from every open-ended source, and
Foam's provider walks the whole workspace on each keystroke.

The issue asks for aliases to appear in VS Code's built-in **Go to File**
(`Ctrl+P`). That is not something an extension can do: Quick Open matches file
paths, and the extension API has no stable contribution point for adding
entries to it. The only related API, `fileSearchProvider`, is proposed-only and
*filters* the files Quick Open shows rather than adding entries, so it cannot
carry an alias that is not part of a filename.

So this spec delivers the nearest thing Foam can own: a Foam command that opens
a picker over the workspace's notes, matching the query against titles and
aliases, which a user can bind to a key of their choosing. Foam already has the
matching logic — `searchWorkspace` in `packages/foam-core/src/commands/search.ts`
matches titles and aliases and backs `foam search` in the CLI — but no VS Code
command uses it; `foam-vscode.open-resource` only shows a picker when it is
handed a filter by a caller.

## Acceptance criteria

- **AC-1**: Given a note titled `Einstein, Albert` with `alias: Einstein` in its
  frontmatter, when the picker is filtered by `einstein`, then that note is
  among the results, labelled with its title and showing the alias that matched.
  _verify: unit_
- **AC-2**: Given a note with no aliases, when the picker is filtered by part of
  its title, then the note is among the results — the command finds notes by
  title as well as by alias.
  _verify: unit_
- **AC-3**: Given a note declaring two aliases that both match the query, when
  the picker is filtered by that query, then the note appears once, not once per
  alias.
  _verify: unit_
- **AC-4**: Given a workspace containing a Markdown note and an attachment
  (`.png`), when the picker is opened, then only the note is offered.
  _verify: unit_
- **AC-5**: Given a result selected in the picker, when the user confirms it,
  then that note opens in the editor.
  _verify: e2e_
- **AC-6**: Given a fresh installation, when the user opens the Command Palette
  and types `Foam`, then the new command is listed; it has no default
  keybinding.
  _verify: human_
- **AC-7**: `docs/user/getting-started/navigation.md` tells a reader how to find
  a note by alias — the new command, and how to bind it to a key. The existing
  `Ctrl+T` route is mentioned too, since it stays.
  _verify: human_

## Out of scope

- **Changing VS Code's built-in Go to File.** Not reachable from an extension,
  as above. The issue's literal request cannot be satisfied; this is the closest
  behaviour that can.
- **Removing or replacing the workspace symbol provider.** `Ctrl+T` keeps
  working as it does today.
- **Making the workspace symbol provider faster.** The reporter calls `Ctrl+T`
  slow on large workspaces; that is a separate, measurable piece of work and
  wants its own issue rather than being bundled here.
- **Full-text search over note bodies.** This picker matches titles and aliases
  only.
- **A default keybinding.** See Open questions.

## Open questions

- **Does Foam filter, or does the VS Code picker?** AC-1 to AC-4 are written as
  unit-verifiable, which assumes Foam computes the candidate list for a query.
  Handing the picker every note and letting VS Code's own fuzzy filter do the
  matching would be less code but would make those four criteria `human` — there
  is no way to type into a quick pick from a test. Assumed: Foam does the
  matching, so the behaviour is tested. Worth confirming at plan time.
- **Should the command ship a default keybinding?** Foam currently binds only
  `alt+d` and `alt+h`. Assumed no: a navigation command close to `Ctrl+P`
  invites conflicts, and AC-7 documents how to bind it. If a default is wanted,
  it is a one-line addition.
- **Substring or fuzzy matching?** `searchWorkspace` supports both
  (`matchMode: 'substring' | 'subsequence'`). Assumed `subsequence`, matching
  what VS Code's own pickers feel like, so `altit` finds `alternative title`.
