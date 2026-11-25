# Plan: Open a note by its alias

## Approach

A new command `foam-vscode.go-to-note` ("Foam: Go to Note") in
`packages/foam-vscode/src/vscode/features/navigation/go-to-note.ts`, registered
from that folder's `index.ts` and contributed in `package.json`. It builds one
quick pick item per note and hands the whole list to
`vscode.window.showQuickPick`, which does the filtering. The maintainer's steer
on the PR settles the spec's first open question in favour of VS Code owning
both the UI and the matching: the command should feel like **Go to File**, so
the fuzzy matcher, the highlighting, the keyboard handling and the sorting are
all VS Code's own, not a Foam reimplementation.

That makes the item shape the whole design, because the item fields are what the
matcher sees. Following the picker already in
`features/export-html-page/index.ts:149` (`pickWorkspaceNote`), which is the
same shape: `label` is the note title, `description` is the workspace-relative
path, and — new here — `detail` is `Alias: <a>, <b>` for notes that declare
aliases. Opening the picker with `matchOnDescription` and `matchOnDetail` makes
all three matchable, so a query hits titles, paths *and* aliases: everything Go
to File can find among notes, plus aliases. The list is sorted by title, as
`pickWorkspaceNote` does.

Consequences worth naming. Foam does no query matching, so
`searchWorkspace` (`packages/foam-core/src/commands/search.ts:50`) — which the
spec's Context named as the existing matching logic — is **not** used: it would
need a query, and one per keystroke, which is exactly the `Ctrl+T` cost the
reporter complains about. It also drops aliases from its `SearchMatch` result
(`search.ts:5`), so it could not label a result with the alias that matched
anyway. The candidate list is `foam.workspace.list().filter(r => r.type ===
'note')`, the same filter `pickWorkspaceNote` uses, which is what satisfies
AC-4. Selection delegates to `OPEN_COMMAND`
(`features/navigation/open-resource.ts:38`) rather than calling `vscode.open`,
so the Markdown editor-association handling added for #1742 is shared instead of
duplicated.

## Work breakdown

1. `go-to-note.test.ts` — failing unit tests for the item builder (AC-1 to
   AC-4) and for the `package.json` contribution (AC-6).
2. `go-to-note.spec.ts` — failing integration test for AC-5: stub
   `window.showQuickPick`, run the command, assert the note is in the editor.
3. `go-to-note.ts` — exported `createNoteItems(workspace)` building the items,
   plus `activate` registering the command: show the picker, then delegate the
   pick to `OPEN_COMMAND`. Telemetry via `getTelemetry()?.trackCommand(...)`,
   as `open-random-note.ts:12` does.
4. Wire it: `features/navigation/index.ts`, and `contributes.commands` in
   `packages/foam-vscode/package.json`. No `contributes.keybindings` entry.
5. `docs/user/getting-started/navigation.md` — a subsection next to the
   existing **Quick Open** one: what the command finds, how to bind a key, and
   that `Ctrl+T` still works (AC-7).

## AC verification map

- AC-1 → `go-to-note.test.ts`: the item for a note titled `Einstein, Albert`
  with `alias: Einstein` is labelled with the title and carries the alias in
  `detail`; the picker is opened with `matchOnDetail`. See Risks — the match
  itself is VS Code's.
- AC-2 → `go-to-note.test.ts`: a note with no aliases still produces an item
  whose `label` is its title (and no `detail`), and `label` is what VS Code
  matches by default.
- AC-3 → `go-to-note.test.ts`: a note with two matching aliases produces
  exactly one item, both aliases on the one `detail` line.
- AC-4 → `go-to-note.test.ts`: a workspace with a note and a `.png` attachment
  yields one item, for the note.
- AC-5 → `go-to-note.spec.ts`: with `showQuickPick` stubbed to return the item
  for a created note, executing the command opens that note.
- AC-6 → `go-to-note.test.ts`: `package.json` contributes the command with
  title `Foam: Go to Note`, does not hide it from the palette with a
  `when: false` menu entry, and contributes no keybinding for it. Reads
  `package.json` the way `settings-defaults.test.ts:6` does. The spec marks
  this `human`; a unit test covers it more cheaply, and the palette is still
  worth one look by hand.
- AC-7 → human: read the docs change.

## Decisions

- **Does Foam filter, or does the VS Code picker?** → The picker, per the
  maintainer's instruction on PR #1793 ("make it look as much as possible as VS
  Code does the UI and the matching"). This moves the *matching* in AC-1 to
  AC-4 out of Foam: the unit tests prove the alias, title and path are in the
  fields VS Code matches and that the matching flags are set, not that a given
  query returns a given note. That part is VS Code's fuzzy matcher and is
  verified by hand. The spec's own wording for the first open question
  anticipated this trade-off.
- **Substring or fuzzy?** → Moot, and better than the spec's assumption:
  VS Code's filter is fuzzy with scoring and highlighting, so `altit` finds
  `alternative title` without Foam implementing it.
- **Default keybinding?** → None, as the spec assumed and the maintainer
  confirmed. AC-7 documents how to bind one. `ctrl+alt+p` / `cmd+alt+p` is a
  free chord in default VS Code and the obvious mnemonic next to `Ctrl+P`, and
  the docs will suggest it as the example binding.
- **No picker `title`.** → Go to File shows only a prompt, so this shows only a
  placeholder ("Search notes by title, alias or path"). The sibling picker in
  `export-html-page` sets a `title`, because it is one step of a wizard.
- **Why `detail` for aliases rather than folding them into `description`?** →
  Keeps the first line looking like Go to File (name, then path) and shows the
  aliases only on notes that have them. The `Alias: ` prefix is a deliberate
  cost: it is matchable text, so a query that is a subsequence of `alias` will
  score aliased notes. It is one word to drop if that proves annoying.
- **Why a `.test.ts` for the item builder, when it touches `vscode`?** →
  `docs/dev/testing-conventions.md:12` reserves `.test.ts` for code with no VS
  Code dependency, and this builder calls `workspace.asRelativePath` and
  `window.showQuickPick`. The precedent followed is the sibling
  `workspace-symbol-provider.test.ts:6` — the other alias-search feature in
  this same folder — which imports `vscode` and runs against the mock in
  `test:unit`. Real-host coverage lives in the `.spec.ts`, which is not
  `@unit-ready`.
- **Which notes does the picker offer?** → `type === 'note'`, so attachments
  are out (AC-4). This is where "pure superset of Go to File" stops being
  literally true: Go to File lists every file in the workspace, while this
  lists what Foam has indexed as notes. Flagged to the maintainer.

## Risks

- **The parts of AC-1 to AC-4 that are now VS Code's.** Handing filtering to
  the picker means no test can type a query. If VS Code ever stopped matching
  `detail` under `matchOnDetail`, every unit test would still pass and alias
  search would be silently dead. The `matchOnDetail: true` assertion in
  `go-to-note.test.ts` is the closest guard available; the real check is AC-6's
  by-hand pass.
- **Result ordering with an empty query.** Go to File opens on recently used
  editors; this opens on an alphabetical list of every note. Deliberately out
  of scope — an MRU list is its own piece of work — but it is the most visible
  difference from the experience being imitated, and the first thing to
  reconsider if the command does not feel like Go to File.
- **Large workspaces.** Every note becomes an item on each invocation. That is
  one pass over the in-memory index — cheaper than `Ctrl+T`, which the reporter
  already finds slow and which re-runs per keystroke — but it is O(notes) of
  allocation per open, and VS Code renders only what is visible. No benchmark
  is warranted yet.
- **Wiring.** The item builder can be perfect while the command is never
  registered, or registered but missing from the palette. AC-5's spec covers
  registration end to end through `commands.executeCommand`, and AC-6's test
  covers the contribution; `features/navigation/index.ts` is the one line
  neither would catch if the spec were skipped in a unit-only run — the spec is
  not `@unit-ready`, so that line is only exercised by `yarn test:e2e`.
