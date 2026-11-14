# Plan

## Approach

### One place decides what a reference names

`Resource.findSection(resource, reference)` is already where every caller asks
which section a reference names — core's `renameSection`, `readAsMarkdown`, the
unknown-section lint rule, go-to-definition and wikilink embeds all go through
it. The slug form is taught there rather than at each caller:

1. an exact label match wins;
2. failing that, a match on the heading's slug;
3. a slug matching more than one heading returns null (AC-3).

The slug is only computed when the exact pass misses, so the common path keeps
doing one string comparison per section. That matters because the lint rule
calls this once per link.

Rewriting needs to know _how_ a link matched, so that a slug link gets the new
slug and a wikilink gets the new text (AC-4). A single
`(label, reference) -> 'exact' | 'slug' | null` helper beside `Section` in
`model/note.ts` carries that, and `findSection` uses it too — one definition of
"names this heading", not two that can drift.

`toSlug` in `utils/slug.ts` is safe to call here: its default import is
`github-slugger`'s constructor and `.slug` is that package's stateless static,
not the de-duplicating instance method, so repeated calls on the same text give
the same answer. Verified, because the stateful variant would silently return
`my-section-1` the second time and the bug would only show on a note linked
twice. Section labels arrive with inline markup already stripped
(`## **Bold** x` -> `Bold x`), which is what GitHub slugs as well, so the label
is the right input.

### Matching and rewriting links

`HeadingEdit.createRenameSectionEdits` compares each backlink's section against
the old label itself rather than going through `findSection`, so it needs the
same helper: skip when it returns null, write `toSlug(newLabel)` on a slug
match and `newLabel` on an exact one.

### Claiming the markdown-link trigger

`MarkdownLink.getSectionRange` returns undefined for anything that is not a
wikilink. Extending it to inline markdown links is enough for
`HeadingEdit.getSectionAtPosition` to accept that trigger unchanged, since it
already resolves the link and looks the section up. The fragment's offset comes
from the existing `directLinkRegex` with the `d` flag, whose `indices` give the
exact span for both `(note.md#frag)` and `(<note.md#frag>)` — no second parse,
no counting characters by hand.

### Renaming a note from a wikilink

A rename provider for the wikilink's target whose edit is a `renameFile`
operation, and nothing else. Foam's existing `onWillRenameFiles` sync in
`features/editing/refactor.ts` then rewrites the wikilinks, and VS Code's
`markdown.updateLinksOnFileMove` rewrites the markdown links, exactly as they
both already do for an explorer rename. A rename inside a `WorkspaceEdit` runs
through `workingCopyFileService.move`, the same path the explorer uses, so
those listeners fire — checked in the workbench bundle, because if it were not
so the provider would have to compute every wikilink edit itself.

The typed name is a filename stem next to the old file, keeping its extension:
renaming `[[todo]]` that resolves to `projects/house/todo.md` produces
`projects/house/tasks.md`. `core/commands/rename.ts` already derives that URI
for the CLI; the provider needs the derivation without the I/O.

## Work breakdown

One commit each, in order. The first two are self-contained and carry most of
the risk.

1. **Section references resolve by slug** — the match helper, `findSection`,
   and its tests (AC-1, AC-2, AC-3).
2. **Renames rewrite each link in its own syntax** — `createRenameSectionEdits`
   and its tests (AC-4).
3. **The markdown-link trigger** — `getSectionRange` for inline links, plus the
   matrix test (AC-5, AC-6, AC-7).
4. **Renaming a note from a wikilink** — the target rename provider and its e2e
   coverage (AC-8, AC-9).

The matrix test in step 3 is table-driven over starting points against link
syntaxes, asserting one expected set of edits for every cell, so that steps 1
and 2 have somewhere obvious to be proven end to end.

## Risks

- **Foam's slug and VS Code's may differ** on exotic headings (emoji, CJK,
  repeated punctuation). Both aim at GitHub's algorithm. Worth a test over the
  awkward cases rather than an assumption.
- **`findSection` is shared, so this reaches further than rename.** Embeds
  start honouring `![[note#my-section]]`, and the unknown-section rule stops
  flagging a wikilink written in slug form. Both look right, neither is in the
  acceptance criteria; if either turns out to be unwanted the matching has to
  move out of `findSection` and into the callers that want it.
- **Reference-style markdown links keep their fragment on the definition
  line**, so `[text][ref]` has nothing under the cursor to start a rename from.
  The rename already updates those definitions when it runs; starting one there
  is untested and probably unsupported. Worth deciding before step 3.
