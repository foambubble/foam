# Plan: Know what is being typed at the cursor, in core

## Approach

A new `packages/foam-core/src/services/completion.ts` exports
`completionAt(text, offset)`, which returns what is being typed at `offset`
or null. It does not match patterns of its own. Instead it closes what is
being typed and asks core's parser whether it reads a link or tag there.
Every disagreement in the spec comes from a host pattern drifting from the
parser: code spans, indented code, HTML blocks, escapes, emoji and nested
brackets. Asking the parser removes that whole class of drift. A scratch
script ran this approach against the built core over every example in AC-1
to AC-8, and every answer matched.

How it works, in order:

1. **Frontmatter.** If the cursor is in frontmatter (`isInFrontMatter`,
   `md.ts:130`, which counts a block that is not yet closed), only a
   `tags` value can complete (`isOnYAMLKeywordLine`, `md.ts:141`). The word
   being typed counts as a tag when `extractTagsFromProp` (`hashtags.ts`)
   reads it back whole once one more character is added. Frontmatter is
   the one place handled by rules rather than by asking the parser: YAML
   that is still being typed does not parse until its brackets close, and
   a `#` typed there is a YAML comment the parser never reads.
2. **Pre-check, no parse.** On the cursor's line, look for an `[[` after
   the last `]]`, or a `#` with no whitespace between it and the cursor.
   If there is neither, return null. Most keystrokes stop here.
3. **Probe.** Take the text before the cursor, append `x]]` and a
   backtick, and parse it.
   - The `x` stands in for a character not yet typed, so an empty `[[` or
     `#` still reads as a link or tag.
   - The backtick closes any inline code still open at the cursor, so it
     reads as code.
   - Look for the wikilink in `links` that ends at the added `]]`; failing
     that, the tag in `tags` that ends at the added `x`.
   - Split the text typed since the `[[` the way `parseWikilink`
     (`markdown-link.ts:10`) splits a link. A `|` means nothing is completed
     (AC-4); a `#` means a section, or a block anchor when `^` follows.
     Otherwise it is a plain link. Once the `|` case has returned null, the
     split is a single `indexOf('#')`, so `parseWikilink` stays private.

Only the text before the cursor is parsed. Block context depends only on
preceding lines, and the added backtick covers inline code that is closed
after the cursor. So text after the cursor never matters (AC-1), and the
cost depends on where the cursor is, not on the note's length.

The parser is a module-level `createMarkdownParser()`, not
`foam.services.parser`. VS Code's parser caches by URI and reports every
parse to the load profiler (`extension.ts:138`), and probe parses would
pollute both. No host registers extra plugins (`extension.ts:138` passes
`[]`), so a default parser reads notes exactly as the workspace does.

The result is one of four kinds, `link`, `section`, `block` or `tag`,
with these fields:
- a `query` that always ends at the cursor;
- a `start` offset: the `[[` (also for an embed) or the `#`. For a
  frontmatter tag it is the typed `#` if there is one, else the tag's
  first character;
- a `target` for a section or block (empty for the note being edited);
- a `frontmatter` flag for a tag.

Offsets go in and come out. The app already works in offsets, and VS Code
has `offsetAt` and `positionAt`.

Each host keeps only its UI:
- **VS Code:** the three providers call `completionAt(document.getText(),
  document.offsetAt(position))` and map `start` and `query` to ranges.
  `WIKILINK_REGEX`, `SECTION_REGEX`, `HASH_REGEX`, `tagMatchIndices` and
  the 50-line frontmatter window go. `grep` finds no other users.
- **App:** `completionAt` and its patterns leave `completion.ts`. The
  mapping from a completion to suggestions moves out of the
  `useSuggestions` hook into a pure function, so AC-10 can be unit-tested.

## Work breakdown

1. **Core tests first.** `packages/foam-core/src/services/completion.test.ts`
   gets AC-1 to AC-8, one `describe` per criterion, with the spec's examples
   as cases. It also gets the cases `completion.test.ts` in the app covers
   today, and the domain cases from VS Code's `tag-completion.spec.ts`:
   frontmatter `tags:` inline, flow list, list item, `tags:‸`, `  -‸`,
   other keys, and `tags:` below the closing `---`. Run `yarn workspace
   @foam/core test:unit` and see them fail.
2. **Core implementation.** Write `services/completion.ts` as described
   above, and export `completionAt` and its result type from
   `src/index.ts` next to `MarkdownLink`.
3. **Bench.** Add `packages/foam-core/src/services/completion.bench.ts`.
   It times `completionAt` with the cursor after an `[[` at the end of
   `makeJournalNote` at 250, 1000 and 4000 lines, reusing the fixtures in
   `packages/foam-core/test/parser-fixtures.ts`. The sizes are its own:
   importing `PARSER_BENCHMARK_SIZES` from a `*.bench.ts` would register
   that file's benches a second time. `vitest.bench.config.ts` already
   picks up `src/**/*.bench.ts`, and `perf-regression.test.ts` gates it once
   the baseline is reseeded.
4. **VS Code (`link-completion.ts`, `tag-completion.ts`).**
   - `WikilinkCompletionProvider` handles `link`, with its range running
     from `start + 2` to the cursor.
   - `SectionCompletionProvider` handles `section` and `block`. An empty
     target resolves to the current document. The range covers the
     `query`.
   - `TagCompletionProvider` handles `tag`. When a frontmatter tag starts
     at a typed `#`, `additionalTextEdits` deletes that `#`, as today.
   - Add two cases to the specs: `[[a [[b` replaces `a [[b`, and
     frontmatter `tags: #` carries the edit that deletes the `#`.
5. **App, on the mobile stack (see Decisions).**
   - `completion.ts` imports `completionAt` from `@foam/core` and drops
     `completionAt`, `OPEN_LINK`, `OPEN_TAG` and `Completion`.
     `applyCompletion` takes core's result and keeps swallowing a
     following `]]` for a link.
   - Add the pure suggestions function next to `suggestNotes`:
     - a link gets notes plus the placeholder link;
     - a tag gets `#tag`, or a bare `tag` in frontmatter;
     - a section or block gets nothing.
   - `Toolbar.tsx`'s `useSuggestions` calls it.
   - `EditorToolbar` computes the completion once per render; today it
     computes it twice, at line 51 and inside `useSuggestions`. In Live
     mode it passes `editor.text` with the offset
     `offsetOfLine(text, editing.current.start) + cursor`, and subtracts
     the same base from `start` before `applyCompletion`.
   - Move the "what is being completed at the cursor" cases out of the
     app's `completion.test.ts`; step 1 already holds them. Add AC-10's
     cases to the same file.
6. **Check.** Run `yarn lint`, `yarn test:unit` and
   `env -u ELECTRON_RUN_AS_NODE yarn test:e2e`, which runs
   `tag-completion.spec.ts` and the bench.

## AC verification map

- AC-1 to AC-8 → `packages/foam-core/src/services/completion.test.ts`
- AC-9 → `packages/foam-vscode/src/vscode/features/navigation/link-completion.spec.ts`
  and `packages/foam-vscode/src/vscode/features/tags/tag-completion.spec.ts`
- AC-10 → `packages/foam-mobile/src/capture/completion.test.ts` (on the
  mobile stack)
- AC-11 → review:
  - a search for `WIKILINK_REGEX|SECTION_REGEX|HASH_REGEX|OPEN_LINK|OPEN_TAG`
    finds nothing;
  - the app's cursor cases now live in core's test.

## Decisions

- **Spec open question, what the app passes in Live mode** → the whole
  note, mapped by offset. The spec's assumption does not hold:
  - `buildNoteUnits` (`packages/foam-mobile/src/reader/note-document.ts`)
    makes each list item a unit of its own, without the lists nested in it.
  - An item nested two levels deep starts with at least four spaces, and
    read on its own it parses as an indented code block. Completion would
    go silent there.
  - Frontmatter and code blocks are whole units and would have been fine.
  - `offsetOfLine` (`packages/foam-mobile/src/editor/line-range.ts:18`)
    gives the base offset.
- **Branches.** Core and VS Code go on `feature/core-completion-context`,
  cut from `origin/main`, with the spec and plan copied into `specs/`.
  The app is not on `main`, so its part (step 5) goes on
  `feature/mobile-core-completion`, cut from the tip of the mobile stack,
  with this branch's core commit cherry-picked under it. Rebasing the
  whole stack onto this branch was the first idea, but it would rewrite
  its 15 branch labels while other sessions use them. When the stack is
  rebased onto `main` after this merges, the cherry-pick drops out as
  already applied.
- **Spec changes from the research.** These are already applied to the
  spec.
  - AC-2 and AC-9 now follow the parser: core reads `[[a [[b]]` and
    `[[foo] bar]]` as single links from the first `[[`.
  - The unclosed-backtick case in AC-8 is kept. A construct opened before
    the cursor counts as open, the rule `isInFrontMatter` already applies.
    The added backtick is how the probe applies that rule.
- **Quoted frontmatter tags.** `tags: ["pkm", "me‸` completes `me`, because
  core reads it as a tag. This is not in the spec; it is assumed and
  tested in step 1.
- **Names.** `completionAt` keeps the app's name. The result type becomes
  `CompletionContext`, since `Completion` is too vague for core's barrel.

## Risks

- **Cost on the typing path.** Each call that passes the pre-check parses
  the text before the cursor. Measured here with a full parse:
  - 250 lines: 5.5 ms
  - 1000 lines: 21 ms
  - 4000 lines: 87 ms

  The bare tree parse is about 80% of that. A phone is slower.
  - VS Code calls per trigger character (`[`, `#`, `^`). A `#` reaches
    both the section and the tag provider, so it costs two parses; this is
    accepted.
  - The app calls on every keystroke while a link or tag is open, hence
    the one-call-per-render change in step 5.
  - The bench catches regressions, not absolute slowness. If large notes
    lag, the follow-up is for each host to pass the start of the cursor's
    top-level block from its last parse. That is out of scope here.
- **Probe artefacts.** The parse of the probe text runs every built-in
  plugin. Its result is thrown away and no cache is involved, so nothing
  leaks. `Logger.debug` logs one "Parsing:" line per probe.
- **Unclosed `---`.** A note that opens with `---` as a horizontal rule and
  never closes it counts as frontmatter throughout, so only `tags` lines
  complete. VS Code already behaves this way within its 50-line window.
- **Wiring the logic tests don't reach.**
  - `link-completion.spec.ts` runs in `test:unit`.
  - `tag-completion.spec.ts` runs only in e2e, so a broken tag adapter
    shows up only there (CI runs it).
  - In the app, the pure suggestions function and `applyCompletion` are
    tested, but the hooks and the Live-mode offset mapping are not. Check
    by hand in the simulator before calling AC-10 done: in Live mode, put
    the cursor in a list item nested three deep, type `[[`, and see note
    suggestions.
