---
issue: 1792
type: feature
created: 2026-11-25
---

# Open a note by its alias

## Context

Notes can declare `alias` in their frontmatter, and those aliases are how some
people think of a note — the note is titled `Objectives and Key Results`, but
nobody says that out loud, so they look for `OKRs`. An alias is usually not a
substring of the title or the file name, which is exactly why Go to File cannot
find it. Today the only way to reach a note by alias is **Go to Symbol in
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
a picker over the workspace's notes, matching the query against titles, aliases
and paths. It should feel like Go to File — same matching, same highlighting,
same recently-used-first list — so that a user who reaches for `Ctrl+P` out of
habit loses nothing by reaching for this instead.

## Acceptance criteria

- **AC-1**: Given a note titled `Objectives and Key Results` with `alias: OKRs`
  in its frontmatter, when the picker is opened, then the note is offered once,
  labelled with its title, and `OKRs` is shown on it as a name it can be found
  by.
  _verify: unit_
- **AC-2**: Given a note with no aliases, when the picker is opened, then the
  note is offered, labelled with its title — the command finds notes by title as
  well as by alias.
  _verify: unit_
- **AC-3**: Given a note declaring two aliases, when the picker is opened, then
  the note appears once with both aliases on it, not once per alias.
  _verify: unit_
- **AC-4**: Given a workspace containing a Markdown note and an attachment
  (`.png`), when the picker is opened, then only the note is offered.
  _verify: unit_
- **AC-5**: Given a note the user has just been on, and other notes earlier in
  the alphabet that the user has not opened, when the picker is opened, then the
  note the user was on is offered first, notes visited before it follow
  most-recent-first, and the notes never visited come last ordered by title.
  _verify: e2e_
- **AC-6**: Given a result selected in the picker, when the user confirms it,
  then that note opens in the editor.
  _verify: e2e_
- **AC-7**: Given the workspace above, when the user types `okrs` into the
  picker, then the note titled `Objectives and Key Results` is among the
  results with the matched characters highlighted; typing part of a folder name
  finds the notes under it, as `Ctrl+P` does.
  _verify: human_
- **AC-8**: Given a fresh installation, when the user opens the Command Palette
  and types `Foam`, then the new command is listed; it is bound by default to
  `Ctrl+Alt+P` / `Cmd+Alt+P`.
  _verify: human_
- **AC-9**: `docs/user/getting-started/navigation.md` tells a reader how to find
  a note by alias — the new command and its shortcut, and how to rebind it. The
  existing `Ctrl+T` route is mentioned too, since it stays.
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
- **Full-text search over note bodies.** This picker matches titles, aliases and
  paths — the fields it puts in front of the matcher — not note content.
- **Listing anything that is not a note.** Go to File lists every file in the
  workspace; this lists what Foam has indexed as a note (AC-4), so it is not a
  literal superset of Go to File.
- **Remembering recently visited notes across restarts.** AC-5's ordering is
  built up within a window, seeded with the note the window opens on. VS Code
  does not expose its own editor history, so matching Go to File exactly here
  would mean persisting a list of our own.

## Open questions

Resolved during planning and implementation; kept for the record.

- **Does Foam filter, or does the VS Code picker?** → **The picker.** The
  maintainer asked for the UI *and* the matching to be VS Code's, so the command
  hands it every note and VS Code's fuzzy matcher does the rest. The cost is the
  one this question predicted: no test can type into a quick pick, so AC-1 to
  AC-5 are written as what the picker is *offered* — which is what a unit test
  can hold — and the matching itself is AC-7, by hand.
- **Should the command ship a default keybinding?** → **Yes**, `Ctrl+Alt+P` /
  `Cmd+Alt+P`, at the maintainer's request. Free in a default VS Code keymap and
  the obvious mnemonic next to `Ctrl+P`.
- **Substring or fuzzy matching?** → **Fuzzy**, with scoring and highlighting,
  because that is what VS Code's own matcher does; Foam implements none of it.
