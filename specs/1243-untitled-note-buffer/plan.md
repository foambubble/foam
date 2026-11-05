# Plan: Open an untitled buffer when a template defines no target

## Approach

The engine makes the call, because it is the only place that already knows
all three inputs: the template's `filepath` metadata, the `defaultFilepath`
option, and whether the resolver can produce a title without prompting.
`NoteCreationEngine.executeMarkdownTemplate`
(`packages/foam-core/src/templates/note-creation-engine.ts:130`) gains a
branch after frontmatter extraction: no template `filepath`, no
`defaultFilepath`, the client can open unsaved editors, and
`Resolver.isTitleAvailable()` is false → return `{ unsaved: true, content }`
instead of deriving a filename. `isTitleAvailable()` (given `FOAM_TITLE`, or
its resolution already cached by `resolveText`) is reintroduced on
`Resolver`; it existed briefly on this PR's earlier incarnation and the
`FOAM_SLUG`/`FOAM_TITLE_SAFE` → `FOAM_TITLE` chain it relies on is pinned on
`main` by ec8cc58. JS templates are untouched: `CreateNoteFunction` requires
a `filepath` (`note-creation-types.ts:56-66`).

Capability is threaded, not assumed: `createNote` in
`note-creation-flow.ts:108` passes `canOpenUnsaved: hooks.openUnsaved !==
undefined` into `processTemplate`, so a client without the new optional
`openUnsaved` hook keeps today's behavior exactly — important because
CLI/MCP (`commands/note-create.ts:112-124`) always pass `fallbackFilepath`
and a title and must never see the new result shape. On an unsaved result
the flow calls `hooks.openUnsaved(content)` and returns a new
`{ status: 'opened-unsaved' }` outcome before any target resolution,
collision handling, trust check or `onDidCreate` — which is also what makes
AC-8's "selection not replaced with a wikilink" hold for free, since the
link replacement lives in `onDidCreate`
(`packages/foam-vscode/src/vscode/services/note-factory.ts:169-177`).

In the adapter, a sibling of `createDocAndFocus`
(`packages/foam-vscode/src/vscode/services/editor.ts:269`) opens the buffer:
`workspace.openTextDocument({ language: 'markdown' })`, `showTextDocument`,
then `editor.insertSnippet(text)` — no `writeFile`, no `save`. Going through
`insertSnippet` keeps tabstops live (AC-2); the mock supports both
(`test/vscode-mock.ts:2189-2219`, `:1133`). `NoteFactory` wires the hook and
maps the new outcome to `{ didCreateFile: false, uri: undefined }`, which
`createNote`'s source-link update already treats as "skip"
(`features/notes/create-note.ts:203`). Finally the `Create New Template`
scaffold (`services/template-service.ts:20`) gains
`foam_template: filepath: '$FOAM_TITLE_SAFE.md'` frontmatter so fresh
templates keep the prompt-and-create flow (AC-7); variables in metadata are
supported (`docs/user/features/templates.md`, Metadata section).

## Work breakdown

1. Failing tests (domain): engine returns the unsaved result without
   touching the title provider; with `canOpenUnsaved` a `FOAM_TITLE`
   template still prompts once and yields a file; `defaultFilepath` still
   wins. Flow: `openUnsaved` called with resolved content, nothing written,
   outcome `opened-unsaved`; without the hook, behavior unchanged.
2. Failing tests (adapter, `create-note.spec.ts` + template-service spec):
   command with a title-less, path-less template opens an untitled markdown
   editor with resolved content and active tabstops, no input box, no file;
   `FOAM_SELECTED_TEXT` template includes the selection and leaves it
   unreplaced; a note from the unmodified scaffold prompts and creates a
   file.
3. Implement: `Resolver.isTitleAvailable()`; engine branch + result union;
   flow hook, capability flag and outcome; `openUnsavedDocAndFocus` in
   `editor.ts`; `NoteFactory` wiring; scaffold frontmatter.
4. Docs (AC-9): `docs/user/features/templates.md` — the `filepath` metadata
   row and the title-variable rows change from "prompts to name the note" to
   the new rule: no `filepath` + title variable → prompt names the file; no
   `filepath` + no title variable → unsaved editor, named on save.
5. Full `yarn test:unit`, `yarn lint`, commit, push.

## AC verification map

- AC-1 → `packages/foam-core/src/templates/note-creation-engine.test.ts`,
  `packages/foam-core/src/services/note-creation-flow.test.ts`, and the
  command-level spec in
  `packages/foam-vscode/src/vscode/features/notes/create-note.spec.ts`
- AC-2 → `create-note.spec.ts` (tabstop resolved by `insertSnippet`, which a
  plain content write would not do)
- AC-3 → `note-creation-engine.test.ts` (prompt-once with `canOpenUnsaved`;
  the no-capability cases are already pinned on `main` by ec8cc58)
- AC-4 → existing `note-creation-flow.test.ts` target tests plus a
  `defaultFilepath`-beats-unsaved engine test
- AC-5 → existing `create-note.spec.ts` default-text tests (`DEFAULT_NEW_NOTE_TEXT`
  uses `FOAM_TITLE`, `note-creation-flow.ts:16`)
- AC-6 → existing daily-note specs; structurally unreachable since
  `daily-note-creation.ts` always supplies `fallbackFilepath` (required
  field, `templates/daily-note-creation.ts:25`)
- AC-7 → `create-note.spec.ts` / `template-service.spec.ts` (scaffold
  prompts and creates a file)
- AC-8 → `create-note.spec.ts`
- AC-9 → human: `docs/user/features/templates.md` diff

## Decisions

- Spec's open question (untitled editor identity) → whatever VS Code
  assigns (`Untitled-1`, …); nothing in Foam reads it, the graph already
  ignores the `untitled` scheme, and the user names the note on save. No
  maintainer input needed.
- Result shape → `processTemplate` returns
  `NoteCreationResult | { unsaved: true; content: string }` rather than
  making `filepath` optional, so existing consumers keep a non-optional
  `filepath` after narrowing, and JS templates keep their validated
  contract.
- Capability flag (`canOpenUnsaved`) rather than engine-always-unsaved →
  clients without the hook (CLI/MCP, any future host) keep today's exact
  behavior with no new unreachable error path.

## Risks

- Wiring risk (unit-green, path never hooked up): covered by the
  command-level spec test that goes through
  `foam-vscode.create-note-from-template` → `NoteFactory` → flow → engine
  and asserts the untitled editor, not just engine output.
- Real-host divergence from the mock (`openTextDocument({language})`,
  `insertSnippet` on an untitled editor): `create-note.spec.ts` is
  `@unit-ready`, so the same assertions run in the e2e suite against the
  real VS Code host in CI.
- The scaffold change alters `Create New Template` output for everyone; if
  its frontmatter format drifted from what
  `extractFoamTemplateFrontmatterMetadata` parses, notes from new scaffolds
  would silently fall into buffer mode — exactly what the scaffold spec test
  exists to catch.
