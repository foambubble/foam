# Plan: Open notes in the editor the user associated with Markdown

## Approach

Most of AC-1's list already honors `workbench.editorAssociations`. Open
Resource goes through `vscode.open` (`open-resource.ts:106`), every Foam tree
view does too (`tree-view-utils.ts:64` and `:95`,
`smart-folders-explorer.ts:213`), the graph webview picks the same command
(`graph-webview/index.ts:326`), and so does note creation when the target file
already exists (`note-factory.ts:83`). That is the mechanism #1675 settled on,
and the spec now says so. Three paths actually bypass it:

- `focusNote` (`services/editor.ts:251`) calls `openTextDocument` +
  `showTextDocument`, which forces a text editor by construction. Its callers
  on an open path are Open Daily Note / Open Daily Note for Date
  (`daily-note-service.ts:70`) and Open Random Note (`open-random-note.ts:28`).
- Show Similar Notes does the same inline (`show-similar-notes.ts:91-94`).
- A wikilink to an existing note is surfaced as a **definition**
  (`navigation-provider.ts:239-252`), and "go to definition" always lands in a
  text editor. Attachments were moved out of the definition path and into a
  `command:vscode.open` DocumentLink for exactly this reason
  (`navigation-provider.ts:342-364`, `:224-229`).

For the first three, the fix is to use `vscode.open` like the paths that
already work. The daily note case is smaller than it looks: when today's file
exists, `NoteFactory.createNote(..., { onFileExists: 'open' })` has *already*
opened it with `vscode.open` before `openDailyNoteFor` calls `focusNote` on it
again — so the line to delete is the second open, not to add a new one.

**Wikilinks: no association predicate.** An earlier draft of this plan gated
the change on whether an association matched the target, to keep peek for
users who had not set one. Review rejected that: it reimplements VS Code's own
pattern matching, which we cannot do faithfully — the keys of
`editorAssociations` are globs resolved by VS Code's internal glob and
priority rules, and any disagreement is a new bug in both directions (we match
where VS Code doesn't → peek lost for nothing; VS Code matches where we don't
→ today's bug, unfixed). So a wikilink to an existing note is treated exactly
like an attachment link: the `attachmentLinks` filter at
`navigation-provider.ts:342-353` widens from `isAttachment(o.target)` to also
accept note targets, `provideDefinition` gets the matching early return next
to the attachment check at `:224-229`, and no configuration is read anywhere.

Keeping both the DocumentLink and the definition is not an option, which the
file already records: the early return for resolved reference-style links at
`navigation-provider.ts:183-189` exists because having both at one range gave
a duplicate "2 definitions" picker on ctrl+click. So the definition goes, for
everybody, and what it provided is rebuilt where Foam can:

- **Hover preview** (AC-8) — Foam's own `provideHover`
  (`navigation-provider.ts:430-453`) currently handles footnotes only. Extend
  it to wikilinks whose target resolves to a note, rendering the target's
  first lines as a `MarkdownString`. This is the affordance users touch most,
  it is a few lines on a provider that is already registered, and once it
  exists the hover no longer depends on how the link is opened.
- **Peek Definition** — lost. The only route to peek without a definition
  provider is the internal `editor.action.peekLocations` command behind a Foam
  command and a keybinding override; it is not public API, so the plan does
  not build it. It is a documented cost (AC-8's docs clause), and if 1.135
  turns out to expose something better the investigation in step 2 will say
  so.
- Ambiguous wikilinks are **not** affected: `provideDefinition` returns a
  single location (`navigation-provider.ts:251`), so there is no multi-target
  picker to lose. The spec claimed one; it does not exist.

**The engine bump is step 1 and lands on its own commit.** It buys the e2e
host the Markdown Editor, which turns AC-6 from a manual check into an
assertion and makes AC-9 answerable. It does not change any of the code above
— the behavior is specified against *any* association.

**The `vscode` mock gets fixed rather than worked around** (AC-1/AC-3 depend
on it). Today `vscode.open` in the mock resolves straight to `showTextDocument`
(`vscode-mock.ts:2569-2571`) and `window.tabGroups` is inert
(`vscode-mock.ts:1818-1827`), so no unit test can tell "opens in the associated
editor" from "opens in a text editor", and `getActiveTabUri` has to be stubbed
to be exercised at all. Step 3 makes the mock model the one rule under test:
`vscode.open` consults `workbench.editorAssociations` and, when a non-`default`
entry matches, pushes a custom-editor tab (`{ uri, viewType }`) as the active
tab instead of creating a text editor; otherwise it shows the text document as
now and records a text tab. Matching in the mock stays deliberately literal —
exact key, plus `*.ext` — because the mock is not trying to be VS Code, only
to make the branch observable. The e2e in step 10 remains the thing that
proves real resolution.

## Work breakdown

1. **Engine bump to 1.135, on its own commit.** `engines.vscode` and
   `@types/vscode` in `packages/foam-vscode/package.json:15` and `:1076`, and
   the e2e host pin at `src/test/run-tests.ts:63`. `vscode-test@^1.3.0`
   (`package.json:1090`) is old; if it cannot launch a 1.135 host, move to
   `@vscode/test-electron` in the same commit. Then `yarn && yarn build`,
   `yarn test:unit`, `yarn test:e2e` — a host bump is where unrelated API
   deprecations surface, and they should not be tangled with the feature.

2. **Markdown Editor investigation, written up before any AC-9 code.** On the
   bumped host: what `viewType` the built-in Markdown Editor registers (needed
   by step 10's association), whether it is a custom text editor over the same
   `TextDocument`, and whether completion, hover and document links from an
   extension reach it. Registration is already right for it —
   `getFoamDocSelectors()` is `{ language: 'markdown', scheme: 'file' }`
   (`editor.ts:68-75`) and the document is the same one — so the question is
   purely whether the editor's input surface routes to the language-features
   service. Record the finding in `spec.md` under AC-9 and in the PR, with the
   evidence. Everything after this step is independent of the outcome except
   step 9.

3. **Fix the `vscode` mock** (own commit, no feature code). Association-aware
   `vscode.open` and tab tracking in `window.tabGroups`, as described above.
   Existing suites must pass unchanged — any test that assumed `vscode.open`
   always produces an active text editor is a test this step has to keep
   honest, not silence.

4. **Failing tests for AC-1.** In `daily-note-service.spec.ts` (already
   `@unit-ready`): with an association configured, Open Daily Note on an
   existing daily note leaves a non-text tab active. Same assertion in a new
   `open-random-note.spec.ts`. Name #1742 in each. Run the suite, confirm they
   fail because the note is opened as a text document.

5. **Implement AC-1.** Delete the redundant `focusNote` call in
   `openDailyNoteFor` (`daily-note-service.ts:69-71`) — the file is already
   open by then. Replace `focusNote(...)` at `open-random-note.ts:28` and the
   `openTextDocument`/`showTextDocument` pair at `show-similar-notes.ts:91-94`
   with `commands.executeCommand('vscode.open', toVsCodeUri(uri))`, written
   inline as the five existing call sites already write it — a one-line
   `openNote()` wrapper would just rename the call.

6. **Failing tests for AC-2 and AC-4, then implement.** In
   `navigation-provider.spec.ts`, beside the `attachment and image navigation`
   block at `:383` and asserting the same way it does (`links[0].target`
   equals a `commandAsURI` for `vscode.open`): a wikilink to an existing note
   is a document link, and `provideDefinition` returns nothing for it. Then
   widen the `attachmentLinks` filter and add the `provideDefinition` early
   return. Existing definition tests for note wikilinks will fail at this
   point — they encode the behavior being replaced, so they move to asserting
   the document link; that is the one place in this plan where a passing test
   changes meaning, and the diff should make it obvious.

7. **AC-8 hover.** Failing test in `navigation-provider.spec.ts` first:
   hovering a wikilink to an existing note returns a hover containing the
   target's text; hovering a placeholder wikilink returns nothing. Then extend
   `provideHover` past the footnote branch. Note `isFootnotesEnabled` gates the
   whole method today (`navigation-provider.ts:434-436`) — the wikilink branch
   must not sit behind it, since footnote support is a separate setting.

8. **AC-3 consumer test, AC-5 test, no production code.** `pickTabUri` already
   returns the URI from a custom-editor tab input (`editor.ts:99-107`) and is
   already tested (`editor.test.ts:40`, which names a markdown-editor
   viewType); every feature AC-3 lists reads the active note through
   `getActiveTabUri` (`connections.ts:18`, `tags-explorer.ts:172`,
   `notes-explorer.ts:43`, `placeholders.ts:155`, `related-notes.ts:40`). With
   step 3's mock a consumer-level test is now possible: open a note with an
   association, assert the connections panel resolves it. For AC-5,
   `createDocAndFocus` → `focusNote` stays as it is (`insertSnippet` needs a
   `TextEditor`); assert that with an association configured a note created
   from a template still opens in a text editor with the snippet applied.
   `createTemplate` (`template-service.ts:196`) keeps `focusNote` for the same
   reason.

9. **AC-9, shaped by step 2.** If language features reach the Markdown Editor,
   the work is whatever step 2 found missing — most likely nothing in Foam, in
   which case the deliverable is the e2e/manual evidence that `[[` completes
   and a wikilink hovers there. If they do not, the deliverable is the written
   finding plus a short "what works in which editor" note in
   `docs/user/features/wikilinks.md`. Either way AC-9 closes with something
   checked, not assumed.

10. **e2e against a real association.** Wrap the Open Daily Note and wikilink
    cases in
    `withModifiedConfiguration('workbench.editorAssociations', { '*.md': '<viewType from step 2>' }, ...)`
    (`test-utils-vscode.ts:209`) and assert
    `window.tabGroups.activeTabGroup.activeTab.input` is not a `TabInputText`.
    This is AC-6, and it is what makes the AC-1/AC-2 assertions above more
    than a check that we call a particular command.

11. **Docs.** `docs/user/features/wikilinks.md` gains a short paragraph: notes
    open in whatever editor `workbench.editorAssociations` names, hovering a
    wikilink previews the target, and Peek Definition on a wikilink is no
    longer available. Plus step 9's note if it applies. AC-8's docs clause is
    this step.

## AC verification map

- AC-1 → `packages/foam-vscode/src/vscode/features/daily-notes/daily-note-service.spec.ts`,
  `packages/foam-vscode/src/vscode/features/navigation/open-random-note.spec.ts`
  (new), plus the e2e in step 10. Open Resource and the tree views are already
  covered by `open-resource.spec.ts` and
  `grouped-resources-tree-data-provider.spec.ts:95` and pass today. Show
  Similar Notes is **not** covered by an automated test — see Risks.
- AC-2 → `navigation-provider.spec.ts` (document link, no definition), plus
  the e2e in step 10.
- AC-3 → `services/editor.test.ts:40` (exists) and a new case in
  `features/notes/connections.spec.ts`.
- AC-4 → the existing daily-note and navigation suites, which must keep
  passing with no association configured, plus step 10's no-association pair.
- AC-5 → `features/notes/create-note.spec.ts` and `daily-note-service.spec.ts`
  (first-time creation, cursor at end).
- AC-6 → step 10.
- AC-7 → CI on the bumped host; step 1 is the whole criterion.
- AC-8 → `navigation-provider.spec.ts` hover cases (step 7) and the docs
  change (step 11).
- AC-9 → step 2's written finding plus step 9; `human` by nature, since the
  thing under test is another editor's behavior.

## Decisions

- **Why reimplement `editorAssociations` matching?** (review) → We don't. The
  gate is gone; see Approach. Note what that costs and who pays: Peek
  Definition on wikilinks goes for every user, not only those who set an
  association. Review's instruction — support what we can, document the rest,
  let users choose — is why that is acceptable, and AC-8 is the part Foam can
  support itself. It also drops a dependency on `micromatch` glob semantics
  matching VS Code's, which was the weakest claim in the previous draft.
- **Should the mock be fixed?** (review) → Yes, step 3, on its own commit.
  Without it every AC-1/AC-3 assertion is a check that we called a command,
  which is exactly the gap the previous draft listed as a risk and then lived
  with. The mock models one rule (a matching association means a non-text
  tab); it does not try to reproduce VS Code's resolution, and step 10 is
  still what proves the real thing.
- **Completion and hover in the Markdown Editor** (review) → In scope as
  AC-9, investigation first (step 2). The honest shape is an investigation
  with a written outcome rather than a behavioral promise, because the answer
  lives in VS Code's implementation of that editor, not in this repository.
  Foam's provider registration is already correct for it, so if it works the
  code change is small or nil; if it does not, the deliverable is evidence and
  documentation.
- **Which version** (review) → 1.135, as asked. This raises the minimum VS
  Code for all users, which is the maintainer's call and has been given on the
  PR.
- **AC-6 as `human`** → Obsolete, now e2e, with Show Similar Notes the one
  path still swept by hand.
- **AC-3's old "Open Daily Note deciding whether today's note is already
  open"** → Removed from the spec. No such check exists:
  `createDailyNoteIfNotExists` tests whether the *file* exists on disk
  (`note-factory.ts:150-157`), never whether it is open in an editor.
- **AC-4's "cursor at the end of the file"** → Narrowed in the spec to
  creation, which is the only case where it is true: for an existing daily
  note `focusNote(uri, didCreateFile)` is reached with `didCreateFile ===
  false` (`daily-note-service.ts:69-70`), so the cursor is not moved today
  either. Creation keeps going through `createDocAndFocus` →
  `focusNote(filepath, true)` (`editor.ts:278`).
- **Smart folder edit/create** (`smart-folders/index.ts:64`,
  `create-smart-folder.ts:61`) still force a text editor. Left alone and now
  listed in the spec's exclusions: those open a query definition, not a note.

## Risks

- **Removing the definition for note wikilinks is the one irreversible-feeling
  change here.** Users who never set an association lose peek on wikilinks and
  get hover from Foam instead of from VS Code. If that lands badly the retreat
  is the gate this plan rejected, with its matching problems, so it is worth
  being explicit in the PR body rather than discovering it in an issue.
- **Show Similar Notes cannot be verified automatically.** The test host does
  not activate the AI features (the mock Foam has no embeddings) and the one
  AI spec that exists is `describe.skip` (`build-embeddings.spec.ts:11`). The
  change there is two lines on an already-proven mechanism, so AC-1 says so
  explicitly and AC-6's sweep covers it, rather than building an embeddings
  harness for it.
- **The mock can only prove the rule we taught it.** A mock that models
  association resolution can drift from VS Code in the same way the rejected
  predicate would have — the difference is that nothing ships on the mock's
  judgement; step 10 asserts against the real resolver.
- **Bumping the e2e host is the step most likely to fail for unrelated
  reasons** (API deprecations, a changed built-in extension, `vscode-test`
  being too old to fetch 1.135). Keeping it on its own commit means a revert
  doesn't take the feature with it. It is also the step the rest of the branch
  waits on, so it goes first.
- **Deleting the `focusNote` call in `openDailyNoteFor` relies on
  `onFileExists: 'open'`** having already opened the file. If a future caller
  passes a different strategy, Open Daily Note silently stops opening
  anything. The AC-1 daily-note test is what catches it, which is why it
  asserts a tab ends up showing the note and not merely that `focusNote` is
  gone.
- **`provideDocumentLinks` runs on every open Markdown document.** With the
  gate gone it no longer reads configuration per link, so the hot path is
  cheaper than the previous draft's; the new cost is `provideHover` parsing
  the target note on hover, which is per-gesture and bounded by reading one
  file.
