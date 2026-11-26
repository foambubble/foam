# Plan: Open a note by its alias

## Approach

A new command `foam-vscode.go-to-note` ("Foam: Go to Note") in
`packages/foam-vscode/src/vscode/features/navigation/go-to-note.ts`, registered
from that folder's `index.ts` and contributed in `package.json`. The items and
their order are domain code with no `vscode` import, in
`packages/foam-vscode/src/go-to-note/` beside `src/lint/` and
`src/daily-note/`; the command is the adapter around them. It builds one
quick pick item per note and hands the whole list to
`vscode.window.showQuickPick`, which does the filtering. The maintainer's steer
on the PR settles the spec's first open question in favour of VS Code owning
both the UI and the matching: the command should feel like **Go to File**, so
the fuzzy matcher, the highlighting, the keyboard handling and the scoring are
all VS Code's own, not a Foam reimplementation.

That makes the item shape the whole design, because the item fields are what the
matcher sees. Following the picker already in
`features/export-html-page/index.ts:149` (`pickWorkspaceNote`), which is the
same shape: `label` is the note title, `description` is the workspace-relative
path, and — new here — `detail` is `Alias: <a>, <b>` for notes that declare
aliases. Opening the picker with `matchOnDescription` and `matchOnDetail` makes
all three matchable, so a query hits titles, paths _and_ aliases: everything Go
to File can find among notes, plus aliases.

The one thing VS Code will not do for us is the order the list opens in. Go to
File opens on recently used editors; an alphabetical list of every note is the
most visible way this command would fail to feel like it (AC-5). `NoteRecency`
in `go-to-note/note-recency.ts` holds the notes the user has been on, most recent first,
and `createNoteItems` sorts by `recency.rank(uri)` then by title — so the list
opens on what the user was just reading and falls back to alphabetical for
everything never visited. Because unvisited notes all rank equal, the title
comparison is what orders them, and `Array.prototype.sort` being stable means
the ordering is total and deterministic. When the user does type, VS Code
re-sorts by match score, with this order breaking ties.

`NoteRecency` is kept free of any `vscode` import: it takes and returns `URI`,
keyed on `uri.asPlain().toString()` so a note reached through a section link is
the same note. The VS Code side is one subscription in `activate` —
`onDidChangeActiveTab` from `services/editor.ts:189`, which already folds
together `onDidChangeActiveTextEditor`, `onDidChangeTabs` and
`onDidChangeTabGroups` — resolving `getActiveTabUri(workspace)` through
`workspace.find` and recording the _resource's_ URI, so the key always matches
the one `createNoteItems` ranks by rather than relying on the tab URI being
spelled identically. `visit()` is idempotent for a URI already at the front, so
that helper's documented duplicate firing needs no debounce here.

Consequences worth naming. Foam does no query matching, so
`searchWorkspace` (`packages/foam-core/src/commands/search.ts:50`) — which
matches titles and aliases and backs `foam search` in the CLI, and was the
obvious candidate — is **not** used: it would need a query, and one per
keystroke, which is exactly the `Ctrl+T` cost the reporter complains about. It
also drops aliases from its `SearchMatch` result (`search.ts:5`), so it could
not label a result with the alias that matched anyway. The candidate list is
`foam.workspace.list().filter(r => r.type === 'note')`, the same filter
`pickWorkspaceNote` uses, which is what satisfies AC-4. Selection delegates to
`OPEN_COMMAND` (`features/navigation/open-resource.ts:38`) rather than calling
`vscode.open`, so the Markdown editor-association handling added for #1742 is
shared instead of duplicated.

## Work breakdown

1. `go-to-note/note-items.test.ts` — failing unit tests for the item builder
   (AC-1 to AC-4, and the ordering half of AC-5).
2. `go-to-note/note-recency.test.ts` — failing unit tests for the recency
   ordering: most recent first, revisits, never-visited, section links, the
   limit.
3. `go-to-note.spec.ts` — failing integration tests for AC-6 (stub
   `window.showQuickPick`, run the command, assert the note is in the editor),
   AC-5 (open two of three notes, assert the order the command offers), the
   match flags the picker is opened with, and the `package.json` contribution
   (AC-8).
4. `go-to-note/note-recency.ts` — `NoteRecency` with `visit()` and `rank()`.
5. `go-to-note/note-items.ts` — `createNoteItems(workspace, recency)`
   building the items, with the path from core's `uriToWorkspacePath`.
6. `go-to-note.ts` — `goToNote(workspace, recency)` showing the picker over
   those items and delegating
   the pick to `OPEN_COMMAND`, and `activate` registering the command plus the
   tab subscription. Telemetry via `getTelemetry()?.trackCommand(...)`, as
   `open-random-note.ts:12` does.
7. Wire it: `features/navigation/index.ts`, `contributes.commands` and
   `contributes.keybindings` in `packages/foam-vscode/package.json`.
8. `docs/user/getting-started/navigation.md` — a subsection next to the
   existing **Quick Open** one: what the command finds, its shortcut, how to
   rebind it, and that `Ctrl+T` still works (AC-9).

## AC verification map

- AC-1 → `note-items.test.ts`: the item for a note titled `Objectives and Key
Results` with `alias: OKRs` is labelled with the title and carries the alias
  in `detail`; `go-to-note.spec.ts` checks the picker is opened with
  `matchOnDetail`. See Risks — the match itself is VS Code's, and is AC-7.
- AC-2 → `note-items.test.ts`: a note with no aliases still produces an item
  whose `label` is its title (and no `detail`), and `label` is what VS Code
  matches by default.
- AC-3 → `note-items.test.ts`: a note with two aliases produces exactly one
  item, both aliases on the one `detail` line.
- AC-4 → `note-items.test.ts`: a workspace with a note and a `.png` attachment
  yields one item, for the note.
- AC-5 → `go-to-note.spec.ts`: four notes created, two of them opened in the
  editor, and the command then offers them most-recently-opened first, with
  the two never opened after them in title order (created in the other order,
  so the order offered is the sort's, not creation's). This is the e2e that covers the
  recency subscription as well as the ordering. Underneath it,
  `note-items.test.ts` holds the item ordering given a recency list, and
  `note-recency.test.ts` the ordering rules themselves (revisits, section
  links, the limit) — neither of which the e2e can reach cheaply.
- AC-6 → `go-to-note.spec.ts`: with `showQuickPick` stubbed to return the item
  for a created note, executing the command opens that note.
- AC-7 → human: type `okrs` and part of a path into the real picker. This is
  the criterion that covers VS Code's matching and the recency subscription,
  neither of which a test can reach.
- AC-8 → `go-to-note.spec.ts`: the extension's `packageJSON` contributes the
  command with title `Foam: Go to Note`, does not hide it from the palette
  with a `when: false` menu entry, and binds it to `ctrl+alt+p` /
  `cmd+alt+p`. The spec marks this `human`; the test covers the contribution,
  and the palette and the shortcut are still worth one look by hand.
- AC-9 → human: read the docs change.

## Decisions

- **Does Foam filter, or does the VS Code picker?** → The picker, per the
  maintainer's instruction on PR #1793 ("make it look as much as possible as VS
  Code does the UI and the matching"). This moves the _matching_ out of Foam:
  the unit tests prove the alias, title and path are in the fields VS Code
  matches and that the matching flags are set, not that a given query returns a
  given note. That part is VS Code's fuzzy matcher and is verified by hand
  (AC-7). The spec's own wording for the first open question anticipated this
  trade-off, and the criteria were reworded to what the tests actually hold.
- **Substring or fuzzy?** → Moot, and better than the spec's assumption:
  VS Code's filter is fuzzy with scoring and highlighting, so `altit` finds
  `alternative title` without Foam implementing it.
- **Default keybinding?** → `ctrl+alt+p` / `cmd+alt+p`, asked for by the
  maintainer on PR #1793. Free in a default VS Code keymap on both platforms
  and the obvious mnemonic next to `Ctrl+P`. No `when` clause, matching the two
  bindings Foam already ships (`alt+d`, `alt+h`).
- **Recency in memory, not persisted.** → A window builds its own list and
  seeds it with the note it opens on, so a restored session is not alphabetical
  from the first keystroke. Persisting to `workspaceState` would survive a
  restart, which is what Go to File does, but it is state to migrate and
  invalidate for a list the user rebuilds within a few navigations. Left out
  until someone misses it.
- **Recency tracks the active _tab_, not the active text editor.** →
  `getActiveTabUri` already resolves custom editors, notebooks and the Markdown
  preview's webview label back to a note (`services/editor.ts:160`), so reading
  a note in preview counts as visiting it. A note is recorded only if
  `workspace.find(uri)` says it is one, so settings tabs and attachments do not
  consume the list.
- **Why cap the list at 50?** → `rank()` is an `indexOf` per note per keypress-
  free open, and the tail of a recency list is indistinguishable from
  alphabetical anyway. The number only has to be larger than the number of
  notes a user navigates between in a session.
- **No picker `title`.** → Go to File shows only a prompt, so this shows only a
  placeholder ("Search notes by title, alias or path"). The sibling picker in
  `export-html-page` sets a `title`, because it is one step of a wizard.
- **Why `detail` for aliases rather than folding them into `description`?** →
  Keeps the first line looking like Go to File (name, then path) and shows the
  aliases only on notes that have them. The `Alias: ` prefix is a deliberate
  cost: it is matchable text, so a query that is a subsequence of `alias` will
  score aliased notes. It is one word to drop if that proves annoying.
- **The path comes from core, not `workspace.asRelativePath`.** →
  `docs/dev/testing-conventions.md:12` reserves `.test.ts` for code with no VS
  Code dependency, and a workspace-relative path needs none: core's
  `uriToWorkspacePath` gives it. With more than one root, the path starts with
  the root's folder name, as `asRelativePath` and Go to File do, so notes at
  the same path in two roots stay apart and typing a root's name finds its
  notes. The one thing core cannot see is a display name given to a folder in
  a `.code-workspace` file; the picker shows the directory name instead. What
  does need `vscode` — the options the picker is opened with, the
  contribution, the recency subscription, opening the pick — is in
  `go-to-note.spec.ts`, which is not `@unit-ready` because the recency test
  needs real editor events.
- **Which notes does the picker offer?** → `type === 'note'`, so attachments
  are out (AC-4). This is where "pure superset of Go to File" stops being
  literally true: Go to File lists every file in the workspace, while this
  lists what Foam has indexed as notes. Flagged to the maintainer.
- **The worked example is an acronym, not a nickname.** → The first draft used
  `alias: Einstein` on a note titled `Einstein, Albert`, which demonstrates
  nothing: the title already contains the query, so `Ctrl+P` on the file name
  would have found it. `alias: OKRs` on `Objectives and Key Results` shares no
  characters in sequence with the title or the file name, so it only works
  because the alias is matched. Used in the spec, the docs and the tests.

## Risks

- **The parts of AC-1 to AC-5 that are now VS Code's.** Handing filtering to
  the picker means no test can type a query. If VS Code ever stopped matching
  `detail` under `matchOnDetail`, every unit test would still pass and alias
  search would be silently dead. The `matchOnDetail: true` assertion in
  `go-to-note.spec.ts` is the closest guard available; the real check is AC-7's
  by-hand pass.
- **The recency subscription needs a real editor.** The mock `vscode` in
  `src/test/vscode-mock.ts:1871` returns no-op disposables for
  `onDidChangeActiveTextEditor` and the `tabGroups` events, so no unit test can
  fire them: a wrong subscription would leave the picker alphabetical with every
  unit test green. That is why AC-5 is an e2e, which opens notes for real. It
  runs the command inside `waitForExpect`, because the editor events it depends
  on are not guaranteed to have been delivered when `showInEditor` resolves —
  if that proves flaky the fix is to wait on the recorded order, not to relax
  the assertion.
- **Scoring can outrank recency.** Once the user types, VS Code sorts by match
  score and recency only breaks ties — so a recently visited note can appear
  below a better match. That is Go to File's behaviour too, and the point of
  handing the matching over.
- **Large workspaces.** Every note becomes an item on each invocation, now with
  an `indexOf` over at most 50 keys per note. That is one pass over the
  in-memory index — cheaper than `Ctrl+T`, which the reporter already finds slow
  and which re-runs per keystroke — but it is O(notes) of allocation per open,
  and VS Code renders only what is visible. No benchmark is warranted yet.
- **Wiring.** The item builder can be perfect while the command is never
  registered, or registered but missing from the palette. AC-6's test covers
  registration end to end through `commands.executeCommand`, and AC-8's covers
  the contribution. Both are in `go-to-note.spec.ts`, which is not
  `@unit-ready`, so the wiring is only exercised by `yarn test:e2e`.
- **`ctrl+alt+p` on Linux.** `Ctrl+Alt+<key>` chords are the ones most often
  taken by desktop environments and by AltGr layouts, where `Ctrl+Alt+P` can
  produce a character instead. VS Code will show the binding either way; the
  keystroke may not reach it. Rebinding is documented (AC-9).
