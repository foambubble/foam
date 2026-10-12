# Plan: Open notes in the editor the user associated with Markdown

## Approach

Most of AC-1's list already honors `workbench.editorAssociations`. Open
Resource goes through `vscode.open` (`open-resource.ts:106`), every Foam tree
view does too (`tree-view-utils.ts:64` and `:95`,
`smart-folders-explorer.ts:213`), the graph webview picks the same command
(`graph-webview/index.ts:326`), and so does note creation when the target file
already exists (`note-factory.ts:83`). That is the mechanism #1675 settled on.
The spec reads as though all of these are broken; they are not, and the plan
below only changes the paths that actually bypass it. Concretely there are two
offenders plus one design difference:

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

For wikilinks the spec's open question assumes we must trade Peek Definition
away. We don't, and AC-4 ("behavior is unchanged from today" with no
association) is the reason not to: peek on wikilinks is today's behavior.
Instead, gate on whether an association actually applies to the target — when
one does, suppress the definition and emit the `command:vscode.open`
DocumentLink; when none does, today's code path runs untouched. That reuses
the existing attachment branch rather than adding a parallel one: its filter
widens from `isAttachment(target)` to `isAttachment(target) ||
hasEditorAssociation(target)`, and `provideDefinition` gets the matching early
return next to the attachment check it already has. Only users who opted into
an association pay for the lost peek, which is a much easier trade to defend
than paying it for everybody.

The engine bump is in scope per the request on the PR. It buys two things: the
e2e host gains the built-in Markdown Editor, so AC-6 stops being a `human`
criterion and folds into AC-1/AC-2 as e2e against the reporter's actual
configuration; and the out-of-scope completion/hover spike becomes runnable.
The bump does not change any of the code above — the behavior is specified
against *any* association, and the Markdown Editor is just the association
worth testing with.

## Work breakdown

1. **Engine bump, on its own commit.** `engines.vscode` and
   `@types/vscode` in `packages/foam-vscode/package.json:15` and `:1076`, and
   the e2e host pin at `src/test/run-tests.ts:63`. Then `yarn && yarn build`,
   `yarn test:unit`, `yarn test:e2e` — a host bump is where unrelated API
   deprecations surface, and they should not be tangled with the feature
   commit. See Decisions for what has to be looked up here.

2. **Failing tests for AC-1.** In `daily-note-service.spec.ts` (already
   `@unit-ready`): Open Daily Note on an existing daily note delegates to
   `vscode.open` and does not force a text editor. Same assertion in a new
   `open-random-note.spec.ts`. Name #1742 in each. Run the suite, confirm they
   fail because the note is opened as a text document. Show Similar Notes has
   no runnable harness — see Risks.

3. **Implement AC-1.** Delete the redundant `focusNote` call in
   `openDailyNoteFor` (`daily-note-service.ts:69-71`) — the file is already
   open by then. Replace `focusNote(...)` at `open-random-note.ts:28` and the
   `openTextDocument`/`showTextDocument` pair at `show-similar-notes.ts:91-94`
   with `commands.executeCommand('vscode.open', toVsCodeUri(uri))`, written
   inline as the five existing call sites already write it — a one-line
   `openNote()` wrapper would just rename the call.

4. **The association predicate.** Two functions in `services/editor.ts`,
   following the `pickTabUri` / `getActiveTabUri` split that file already
   documents at `:91-93`: a pure
   `matchesEditorAssociation(associations, path)` that globs a path against
   the keys of an associations map and ignores entries whose value is
   `default`, and a thin `hasEditorAssociation(uri)` that reads
   `workbench.editorAssociations` and calls it. The config read belongs here
   and not in the navigation provider, and `config.ts:18` is the precedent for
   Foam reading a non-`foam.*` setting. Glob matching uses `micromatch`,
   already a `foam-vscode` dependency — no new one. Pure-function cases go in
   `editor.test.ts`: `*.md` matches, `**/*.md` matches, a bare filename key
   matches on basename only, `default` is not an association, an empty map is
   not an association.

5. **Failing tests for AC-2 and AC-4.** In `navigation-provider.spec.ts`,
   beside the `attachment and image navigation` block at `:383` and asserting
   the same way it does (`links[0].target` equals a `commandAsURI` for
   `vscode.open`): with an association, a wikilink to an existing note is a
   document link and `provideDefinition` returns nothing for it; with no
   association, it is a definition and not a document link. The second half of
   that pair is AC-4 and must pass before and after.

6. **Implement AC-2.** Widen the `attachmentLinks` filter at
   `navigation-provider.ts:342-353` and add the early return in
   `provideDefinition` next to `:224-229`. The predicate reaches the provider
   as a defaulted constructor parameter, the way `isFootnotesEnabled` already
   does (`navigation-provider.ts:88`), so the tests above pick a branch
   without touching configuration.

7. **AC-3 needs no code.** `pickTabUri` already returns the URI from a
   custom-editor tab input (`editor.ts:99-107`), it is already tested
   (`editor.test.ts:40`, which names the "Reopen With" markdown editor), and
   every feature AC-3 lists reads the active note through `getActiveTabUri`
   (`connections.ts:18`, `tags-explorer.ts:172`, `notes-explorer.ts:43`,
   `placeholders.ts:155`, `related-notes.ts:40`). What is missing is a
   consumer-level test, so add one: with a custom-editor tab active, the
   connections panel resolves that note. See Decisions for AC-3's daily-note
   clause.

8. **AC-5 test, no code.** `createDocAndFocus` → `focusNote` stays as it is;
   `insertSnippet` needs a `TextEditor` and there is no equivalent outside
   one. Assert in the create-note specs that with an association configured a
   note created from a template still opens in a text editor with the snippet
   applied. `createTemplate` (`template-service.ts:196`) keeps `focusNote` for
   the same reason, which is the spec's templates exclusion.

9. **e2e against a real association.** Once the host is bumped, wrap the Open
   Daily Note and wikilink cases in
   `withModifiedConfiguration('workbench.editorAssociations', { '*.md': '<markdown editor viewType>' }, ...)`
   (`test-utils-vscode.ts:209`) and assert
   `window.tabGroups.activeTabGroup.activeTab.input` is not a `TabInputText`.
   This is AC-6, and it is what makes the AC-1/AC-2 assertions in steps 2 and
   5 more than a check that we call a particular command.

No documentation change. Nothing in `docs/` mentions `editorAssociations` or
peek on wikilinks today, so there is no page that becomes wrong — #1675
shipped the same way.

## AC verification map

- AC-1 → `packages/foam-vscode/src/vscode/features/daily-notes/daily-note-service.spec.ts`,
  `packages/foam-vscode/src/vscode/features/navigation/open-random-note.spec.ts`
  (new), plus the e2e in step 9. Open Resource and the tree views are already
  covered by `open-resource.spec.ts` and
  `grouped-resources-tree-data-provider.spec.ts:95` and pass today. Show
  Similar Notes is **not** covered by an automated test — see Risks.
- AC-2 → `packages/foam-vscode/src/vscode/features/navigation/navigation-provider.spec.ts`
  (association set: document link, no definition), plus the e2e in step 9.
- AC-3 → `packages/foam-vscode/src/vscode/services/editor.test.ts:40` (exists)
  and a new case in
  `packages/foam-vscode/src/vscode/features/notes/connections.spec.ts`.
- AC-4 → `navigation-provider.spec.ts` (no association: definition, no
  document link) and the existing daily-note and navigation suites, which must
  keep passing unchanged.
- AC-5 → `packages/foam-vscode/src/vscode/features/notes/create-note.spec.ts`
  and `daily-note-service.spec.ts` (first-time creation).
- AC-6 → step 9's e2e, which replaces the spec's `human` verification once the
  engine is bumped.

## Decisions

- **Is losing Peek Definition on wikilinks worth it?** (spec open question) →
  The trade isn't necessary. Gate the document-link path on an association
  actually matching the target, and peek is unchanged for every user who has
  not set one — which AC-4 requires anyway. Users who have set an association
  lose peek on wikilinks; that is the narrowest version of the cost the spec
  was ready to pay in full. Per `navigation-provider.ts:187-189`, the
  definition provider already steps aside for resolved reference-style links,
  so a link type opting out of definitions is an established shape here.
- **Should the completion/hover half become a spike?** (spec open question) →
  Yes, separate issue, unchanged by this plan. The engine bump makes it
  answerable, which is an argument for filing it now rather than a reason to
  widen this spec.
- **AC-6 as `human`** (spec open question) → Obsolete. With the engine bumped
  it is an e2e assertion, so nothing merges on an unverified tick.
- **Which version to bump to, and the Markdown Editor's viewType** → Both have
  to be read off a VS Code build that has the editor; neither is derivable
  from this repository and this environment has no network access, so the plan
  deliberately does not name a number. At implementation time: the minimum is
  the release that shipped the built-in Markdown Editor, and the viewType is
  the one `workbench.editorAssociations` autocompletes to for it (equivalently
  what "Reopen Editor With…" shows). Bumping `engines.vscode` raises the
  minimum VS Code for all users, so it is the maintainer's call, which the
  request on the PR has already given.
- **AC-3's "Open Daily Note deciding whether today's note is already open"** →
  No such check exists. `createDailyNoteIfNotExists` tests whether the *file*
  exists on disk (`note-factory.ts:150-157`), never whether it is open in an
  editor, so there is nothing here that can be confused by a non-text tab.
  Treating the clause literally would mean building editor-state inspection
  that nothing exercises. Reading it as the file-existence check, it is
  already correct and step 2 covers it.
- **AC-4's "the daily note still opens with the cursor at the end of the
  file"** → True only when the note is created. For an existing daily note
  `focusNote(uri, didCreateFile)` is reached with `didCreateFile === false`
  (`daily-note-service.ts:69-70`), so the cursor is not moved today either.
  Creation keeps going through `createDocAndFocus` → `focusNote(filepath,
  true)` (`editor.ts:278`), so the behavior that exists is preserved; the
  criterion is just describing it too broadly.
- **Smart folder edit/create** (`smart-folders/index.ts:64`,
  `create-smart-folder.ts:61`) still force a text editor. Left alone: those
  open a query definition, not a note, which is the same reasoning as the
  spec's templates exclusion.

## Risks

- **The AC-1/AC-2 unit assertions can only prove we hand off to
  `vscode.open`** — the mock resolves that command straight to
  `showTextDocument` (`vscode-mock.ts:2569-2571`), so no mock-based test can
  show an association being honored. Step 9's e2e is the only thing that
  closes the gap between "we call the right command" and "the note opens in
  the right editor", and it is the step that depends on the engine bump. If
  the bump slips, AC-1/AC-2 are verified at the seam only and AC-6 goes back
  to being a human check — say so rather than tick them.
- **Show Similar Notes cannot be verified automatically, and AC-1 asks for
  e2e.** The test host does not activate the AI features (the mock Foam has no
  embeddings) and the one AI spec that exists is `describe.skip`
  (`build-embeddings.spec.ts:11`). The change there is two lines on an
  already-proven mechanism, so the plan accepts code review plus AC-6's manual
  sweep rather than building an embeddings harness for it — but AC-1's
  `verify: e2e` is not honest for that one path, and the spec should say so.
- **Deleting the `focusNote` call in `openDailyNoteFor` relies on
  `onFileExists: 'open'`** having already opened the file. If a future caller
  passes a different strategy, Open Daily Note silently stops opening
  anything. The AC-1 daily-note test is what catches it, which is why it
  asserts an editor ends up showing the note and not merely that `focusNote`
  is gone.
- **`workbench.editorAssociations` pattern matching is a reimplementation of
  VS Code's own resolution** and can disagree with it — a pattern we match but
  VS Code doesn't means a wikilink becomes a document link that still opens in
  a text editor (peek lost for nothing); the reverse means the association is
  ignored, i.e. today's bug. The pure-function cases in step 4 pin the shapes
  we claim to support; anything more exotic degrades to current behavior
  rather than breaking.
- **Bumping the e2e host is the step most likely to fail for unrelated
  reasons** (API deprecations, a changed built-in extension). Keeping it on
  its own commit means a revert doesn't take the feature with it.
- **`provideDocumentLinks` runs on every open Markdown document**, so the
  predicate is on a hot path. It reads configuration per call per link; if
  that shows up, cache the parsed associations behind the existing
  `monitorFoamVsCodeConfig`-style invalidation rather than threading it
  through the provider's constructor. Not doing it upfront — there is no
  measurement saying it matters.
