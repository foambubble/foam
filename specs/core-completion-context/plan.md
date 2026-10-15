# Plan: Know what is being typed at the cursor, in core

## Approach

A new `packages/foam-core/src/services/completion.ts` exports
`completionAt(text, offset)`, which returns what is being typed at `offset`
or null. It reads only the cursor's line and the frontmatter before it, and
applies core's own rules for what a wikilink, a tag and frontmatter are.
Every rule comes from an existing core helper or from how core's parser
reads a link, so the hosts stop drifting from each other and from the
model.

How it works, in order:

1. **Frontmatter.** If the cursor is in frontmatter (`isInFrontMatter`,
   `md.ts:130`, which counts a block that is not yet closed), only a
   `tags` value can complete (`isOnYAMLKeywordLine`, `md.ts:141`). The word
   being typed counts as a tag when `extractTagsFromProp` (`hashtags.ts`)
   reads it back whole once one more character is added.
2. **Wikilink.** The link being typed opens at the first `[[` after the
   last `]]` on the line that no backslash escapes. That is where core's
   parser starts one: it reads `[[a [[b]]` and `[[foo] bar]]` as single
   links, and skips an escaped `\[[` for the next `[[`.
   - Split the text typed since the `[[` the way `parseWikilink`
     (`markdown-link.ts:10`) splits a link. A `|` means nothing is completed
     (AC-4); a `#` means a section, or a block anchor when `^` follows.
     Otherwise it is a plain link.
   - Once the `|` case has returned null, the split is a single
     `indexOf('#')`, so `parseWikilink` stays private.
3. **Tag.** `extractHashtags` (`hashtags.ts`), core's tag rule, runs on the
   line with one character added. The tag it finds ending at that
   character is the one being typed. That covers which characters a tag
   holds, emoji included, and that a `#` must start a word.

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
  `useSuggestions` hook into a pure function, so AC-9 can be unit-tested.

### Tried and dropped: asking the parser

The first version also told code and HTML from text. It closed what was
being typed (appending `x]]` and a backtick to the text before the cursor),
parsed that with a module-level `createMarkdownParser()`, and looked for
the link or tag ending at the cursor. That matched the parser exactly, but
it cost a parse of everything before the cursor on each call while a `[[`
or `#` was open. Against the old host code on a journal note, cursor at
the end:

| Note | Old app | Old VS Code tag | Parse-based |
| --- | --- | --- | --- |
| 250 lines | 6 to 20 µs | 9 µs | 7 ms |
| 1000 lines | 20 to 70 µs | 20 µs | 24 ms |
| 4000 lines | 0.1 to 0.3 ms | 80 µs | 100 ms |

The app asks on every keystroke while a link or tag is open, so the parse
went, and code and HTML moved out of scope. The rule-based version costs
about what the old app code did: one pass over the text before the cursor,
in `isInFrontMatter`.

On text with no code or HTML, a fuzz of the two versions over random
strings of `[[`, `]]`, `#`, brackets, escapes and emoji agreed except
where core's own reading has quirks:
- a `#` right after `[`, `]` or an escape counts as starting a word, since
  the parser splits text there;
- an empty `[[]]` closes no link.

The old host code did not complete those either. The parse-based version
is commit `fb56d1f4` on this branch, for the follow-up that parses only the
cursor's block.

## Work breakdown

1. **Core tests first.** `packages/foam-core/src/services/completion.test.ts`
   gets AC-1 to AC-7, one `describe` per criterion, with the spec's examples
   as cases. It also gets the cases `completion.test.ts` in the app covers
   today, and the domain cases from VS Code's `tag-completion.spec.ts`:
   frontmatter `tags:` inline, flow list, list item, `tags:‸`, `  -‸`,
   other keys, and `tags:` below the closing `---`. Run `yarn workspace
   @foam/core test:unit` and see them fail.
2. **Core implementation.** Write `services/completion.ts` as described
   above, and export `completionAt` and its result type from
   `src/index.ts` next to `MarkdownLink`.
3. **VS Code (`link-completion.ts`, `tag-completion.ts`).**
   - `WikilinkCompletionProvider` handles `link`, with its range running
     from `start + 2` to the cursor.
   - `SectionCompletionProvider` handles `section` and `block`. An empty
     target resolves to the current document. The range covers the
     `query`.
   - `TagCompletionProvider` handles `tag`. When a frontmatter tag starts
     at a typed `#`, `additionalTextEdits` deletes that `#`, as today.
   - Add two cases to the specs: `[[a [[b` replaces `a [[b`, and
     frontmatter `tags: #` carries the edit that deletes the `#`.
4. **App, on the mobile stack (see Decisions).**
   - `completion.ts` imports `completionAt` from `@foam/core` and drops
     `completionAt`, `OPEN_LINK`, `OPEN_TAG` and `Completion`.
     `applyCompletion` takes core's result and keeps swallowing a
     following `]]` for a link.
   - Add the pure `suggestionsFor` next to `suggestNotes`, taking the
     `Suggestion` type and `VISIBLE_SUGGESTIONS` with it from
     `Toolbar.tsx`:
     - a link gets notes plus the placeholder link;
     - a tag gets `#tag`, or a bare `tag` in frontmatter;
     - a section or block gets nothing.
   - `applyCompletion` adds no space after a frontmatter tag, where a `,`
     or `]` follows rather than prose.
   - `Toolbar.tsx`'s `useSuggestions` takes the completion and calls
     `suggestionsFor`. Each caller computes the completion once per render;
     `EditorToolbar` used to compute it twice, at line 51 and inside
     `useSuggestions`. `EditorToolbar` passes the field, as before.
   - Move the "what is being completed at the cursor" cases out of the
     app's `completion.test.ts`; step 1 already holds them. Add AC-9's
     cases to the same file.
5. **Check.** Run `yarn lint`, `yarn test:unit` and
   `env -u ELECTRON_RUN_AS_NODE yarn test:e2e`, which runs
   `tag-completion.spec.ts`.

## AC verification map

- AC-1 to AC-7 → `packages/foam-core/src/services/completion.test.ts`
- AC-8 → `packages/foam-vscode/src/vscode/features/navigation/link-completion.spec.ts`
  and `packages/foam-vscode/src/vscode/features/tags/tag-completion.spec.ts`
- AC-9 → `packages/foam-mobile/src/capture/completion.test.ts` (on the
  mobile stack)
- AC-10 → review:
  - a search for `WIKILINK_REGEX|SECTION_REGEX|HASH_REGEX|OPEN_LINK|OPEN_TAG`
    finds nothing;
  - the app's cursor cases now live in core's test.

## Decisions

- **What the app passes in Live mode** → the field, as before.
  - The rules read only the cursor's line and the frontmatter before it.
  - The frontmatter is a unit of its own in Live mode, with both of its
    `---` lines (`buildNoteUnits`,
    `packages/foam-mobile/src/reader/note-document.ts`).
  - The parse-based version needed the whole note, because a list item
    nested two deep, read on its own, parses as indented code.
- **Branches.** Core and VS Code go on `feature/core-completion-context`,
  cut from `origin/main`, with the spec and plan copied into `specs/`.
  - The app is not on `main`, so its part (step 4) goes on
    `feature/mobile-core-completion`, cut from the tip of the mobile stack,
    with this branch's core commits cherry-picked under it.
  - Rebasing the whole stack onto this branch would have rewritten its 15
    branch labels while other sessions use them.
  - This repo squash-merges, so when the stack is rebased onto `main` after
    this merges, the cherry-picked core commits won't match the squash.
    Skip them during that rebase (`git rebase --skip`), since `main` then
    holds their result.
- **Spec changes from the research.** These are already applied to the
  spec.
  - AC-2 and AC-8 follow the parser: core reads `[[a [[b]]` and
    `[[foo] bar]]` as single links from the first `[[`.
  - Code and HTML moved to Out of scope, for the cost above.
- **Quoted frontmatter tags.** `tags: ["pkm", "me‸` completes `me`, because
  core reads it as a tag. This is not in the spec; it is assumed and
  tested in step 1.
- **Names.** `completionAt` keeps the app's name. The result type becomes
  `CompletionContext`, since `Completion` is too vague for core's barrel.

## Risks

- **Unclosed `---`.** A note that opens with `---` as a horizontal rule and
  never closes it counts as frontmatter throughout, so only `tags` lines
  complete. VS Code already behaves this way within its 50-line window.
- **Wiring the logic tests don't reach.**
  - `link-completion.spec.ts` runs in `test:unit`.
  - `tag-completion.spec.ts` runs only in e2e, so a broken tag adapter
    shows up only there (CI runs it).
  - In the app, `suggestionsFor` and `applyCompletion` are tested, but the
    hooks are not. Check by hand in the simulator before calling AC-9
    done: type `[[` and `#` in capture and in the editor's Live and Source
    modes, and `tags: #` in Source mode's frontmatter.
