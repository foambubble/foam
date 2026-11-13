# Plan: Open an untitled buffer when a template defines no target

## Approach

The engine decides the shape, because it is the only place that sees the
template's `filepath`, the `defaultFilepath` option and the resolver.
`NoteCreationEngine.executeMarkdownTemplate`
(`packages/foam-core/src/templates/note-creation-engine.ts`) keeps the target
question separate from the title question: no template `filepath`, no
`defaultFilepath`, and a client that can open unsaved editors →
`{ unsaved: true, content }`. Only when a title is already available
(`Resolver.isTitleAvailable()`: given upfront, or requested while resolving
the content) does the result carry a `suggestedFilepath`, derived exactly as
the old default filename was (`generateDefaultFilepath` + sanitizing, now
shared through `toTargetUri`). The title is never prompted for the sake of a
name. JS templates are untouched: `CreateNoteFunction` requires a
`filepath`.

`createNote` (`packages/foam-core/src/services/note-creation-flow.ts`) opts
in only when the client provides the `openUnsaved` hook **and** a template
was loaded — the built-in default text always creates a file (AC-6). The
target loop (relative resolution, workspace containment, collision handling
via `onFileExists`) is extracted into `resolveTarget` and runs for both file
targets and suggested unsaved paths. The probe of 2026-11-13 showed why the
suggested path needs it: VS Code saves an untitled-with-path document to
that path without a dialog, and refuses to open one whose path already
exists. `onDidCreate` does not run for unsaved notes, so the selection is
not replaced with a link (AC-9).

In the adapter, `openUnsavedDocAndFocus`
(`packages/foam-vscode/src/vscode/services/editor.ts`) opens
`toVsCodeUri(uri).with({ scheme: 'untitled' })` when a path is suggested and
a plain untitled markdown document otherwise, then inserts the content as a
snippet so tabstops stay live (AC-2). The test mock now refuses an untitled
document over an existing file, as VS Code does, and keeps untitled
documents in memory. The `Create New Template` scaffold declares
`filepath: '$FOAM_TITLE_SAFE.md'` (AC-8).

## Work breakdown

1. Failing tests: engine (unsaved with and without suggested path, per
   title variable), flow (suggested path resolved and checked; existing
   path → `onFileExists`; stop → `exists`; built-in default → file),
   adapter (`create-note.spec.ts`: title-named untitled editor, nothing on
   disk; existing file → path prompt, file untouched).
2. Implement: result type, engine branch + `toTargetUri`, flow
   `resolveTarget` + hook signature + outcome `uri`, adapter helper, mock.
3. Docs (AC-10): the `filepath` metadata row.
4. `yarn test:unit`, `yarn lint`, commit, push.

## AC verification map

- AC-1 → `note-creation-engine.test.ts`, `note-creation-flow.test.ts`,
  `create-note.spec.ts` (no-title untitled editor)
- AC-2 → `create-note.spec.ts` (tabstop expanded by `insertSnippet`)
- AC-3 → `note-creation-engine.test.ts` (`it.each` over the three title
  variables), `note-creation-flow.test.ts`, `create-note.spec.ts`
- AC-4 → `note-creation-flow.test.ts` (ask / stop), `create-note.spec.ts`
  (path prompt, existing file untouched)
- AC-5 → existing flow target tests and `defaultFilepath`-wins engine test
- AC-6 → `note-creation-flow.test.ts` (built-in default with the hook) and
  the existing no-params `create-note.spec.ts` test
- AC-7 → existing daily-note specs; unreachable by construction
  (`fallbackFilepath` is required in `daily-note-creation.ts`)
- AC-8 → `create-note.spec.ts` (unmodified scaffold prompts and creates a
  file)
- AC-9 → `create-note.spec.ts`
- AC-10 → human: `docs/user/features/templates.md`

## Decisions

- No deprecation period: one save of a title-named unsaved note produces
  the file the old flow created (probe, spec Context).
- `foam-vscode.create-note` with `text` and no `notePath` follows the
  template rule and opens unsaved (spec Open questions).
- `onFileExists: 'overwrite'` keeps its meaning for suggested paths: the
  caller asked for it explicitly. The default (`ask`) never deletes.

## Risks

- Real-host divergence from the mock: `create-note.spec.ts` is
  `@unit-ready`, so the same assertions run against VS Code in CI e2e.
- The probe covered `TextDocument.save()`; a user's Ctrl+S goes through the
  same save path for untitled-with-path documents, but is not exercised by a
  test.
