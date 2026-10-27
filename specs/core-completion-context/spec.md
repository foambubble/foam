---
type: feature
created: 2026-10-14
---

# Know what is being typed at the cursor, in core

## Context

Three places decide whether the text before the cursor is an open wikilink,
a wikilink section or a tag, and each does it with its own patterns: link
and section completion in `foam-vscode` (`link-completion.ts`), tag
completion in `foam-vscode` (`tag-completion.ts`), and the mobile app's
capture and editor completion (`packages/foam-mobile/src/capture/completion.ts`,
on `feature/mobile-conflict-resolution`). The app is moving its own text
parsing onto `@foam/core` — day links, embeds, the Journal and frontmatter
went through core on 2026-10-14 — and this is the clearest case left where
desktop and the app parse the same thing separately and get different
answers.

This spec asks for one answer in core, which the three hosts call, keeping
only their UI: which suggestions to show, how they are ranked, and what
picking one writes. The answer follows core's own rules for what a
wikilink, a tag and frontmatter are, so nothing is suggested that Foam will
then ignore, with one exception for now: code and HTML (see Out of scope).
Frontmatter opened and not yet closed counts as open, as `isInFrontMatter`
already treats frontmatter that "may stop where a note is being written".

### Where the hosts disagree today

Checked by running each host's patterns over the same text (`‸` is the
cursor), and by parsing the text, once closed, with `createMarkdownParser`
for the last column:

| Typed | VS Code | Mobile | Core reads, once closed |
| --- | --- | --- | --- |
| `[[note#Met‸` | section of `note`, query `Met` | link, query `note#Met` | link to `note`, section `Met` |
| `[[note#^bl‸` | block anchor of `note` | link, query `note#^bl` | link to `note`, block `bl` |
| `[[#Met‸` | section of the current note | link, query `#Met` | link to section `Met` of this note |
| `[[foo #ta‸` | tag `ta` (and an empty section lookup) | link, query `foo #ta` | link to `foo `, section `ta`; no tag |
| `[[a [[b‸` | link, query `a `, replacement range off by two | link, query `a [[b` | one link, target `a [[b` |
| `[[foo] bar‸` | link, query `foo`, replacement range over `bar` | nothing | one link, target `foo] bar` |
| `[[note\|Al‸` | link, query `note\|Al` | link, query `note\|Al` | link to `note`, alias `Al` |
| `[[note#a#b‸` | section of `note#a` | link | link to `note`, section `a#b` |
| `\[[zet‸` | link | link | nothing |
| `` `see [[zet‸` ``, `` `x #ta‸` `` | completes | completes | nothing |
| fenced, indented or HTML block | completes | completes | nothing |
| `#🚀‸`, `#👍🏽‸` | tag | nothing | tag |
| `#❤️‸` | nothing | nothing | tag |
| frontmatter `related: [[zet‸` | link | link | nothing |
| frontmatter `tags: pk‸` | tag | nothing | tag |
| frontmatter `tags: #pk‸` | tag, `#` removed on accept | tag, inserts `#pkm` — a YAML comment, so the tag is lost | nothing |
| frontmatter `tags: pkm/‸` | nothing (previous character must be `#`, `[`, space or a word character) | — | tag `pkm/` |
| frontmatter `title: #pk‸` | nothing | tag | nothing |

VS Code also looks for frontmatter only in the first 50 lines; core has no
such limit.

Agreements worth keeping: only the text before the cursor counts; a `#` must
start a word (`C#`, `##`, `# ` are not tags); a link does not run across
lines; `![[` completes like `[[`.

## Acceptance criteria

`‸` marks the cursor. "Nothing" means no link, section or tag is being typed.

- **AC-1**: Given `Read [[zet‸`, then a wikilink is being typed with query
  `zet`, opening at the `[[`. `[[‸` gives an empty query; `![[im‸` gives
  query `im`, opening at the `[[`. Text after the cursor makes no
  difference: `Read [[zet‸ later` and `Read [[zet‸]]` give the same answer.
  _verify: unit_

- **AC-2**: The link being typed is the wikilink core reads once it is
  closed: `[[a [[b‸` gives query `a [[b` and `[[foo] bar‸` gives
  `foo] bar`, both opening at the first `[[`; `[[a]] [[b‸` gives `b`. Given
  `[[zettelkasten]] now‸`, an escaped `\[[zet‸`, or a `[[` only on an earlier
  line, then nothing.
  _verify: unit_

- **AC-3**: Given `[[zettelkasten#Met‸`, then a section of `zettelkasten` is
  being typed with query `Met`; the target ends at the first `#`
  (`[[note#a#b‸` is a section of `note` with query `a#b`). `[[#Met‸` is a
  section of the note being edited (an empty target).
  `[[zettelkasten#^bl‸` is a block anchor of `zettelkasten` with query `bl`.
  A `#` inside an open wikilink is never a tag: `[[foo #ta‸` is a section,
  not a tag.
  _verify: unit_

- **AC-4**: Given `[[zettelkasten|Zet‸` or `[[zettelkasten#Method|Me‸`, then
  nothing: past the `|` the alias is free text.
  _verify: unit_

- **AC-5**: Given `Idea #pk‸`, then a tag is being typed with query `pk`,
  opening at the `#`; `#‸` gives an empty query and `a #pkm/me‸` gives
  `pkm/me`. A query holds exactly the characters core accepts in a tag, so
  `#🚀‸`, `#❤️‸`, `#👍🏽‸` and `#123‸` are tags being typed, and
  `Idea #pkm and‸` and `#pkm.‸` are nothing. A `#` that does not start a word
  is nothing: `C#‸`, `##‸`, `# ‸`, `(#ta‸`, `\#ta‸`.
  _verify: unit_

- **AC-6**: Given the cursor in a note's frontmatter in the value of `tags` —
  `tags: pkm, me‸`, `tags: [pkm, me‸`, or a list item under it (`  - me‸`) —
  then a frontmatter tag is being typed with query `me`; `tags: ‸` gives an
  empty query and `tags: pkm/‸` gives `pkm/`. Given `tags: #pk‸`, the same
  with query `pk`, and the answer says where that `#` is, since in YAML it
  starts a comment. Right after the `:` or a list item's `-`, before the
  space that follows it (`tags:‸`, `  -‸`), nothing. Frontmatter opened and
  not yet closed counts to the cursor, wherever in the note that is.
  _verify: unit_

- **AC-7**: Given the cursor in frontmatter anywhere but the value of
  `tags` — `title: #pk‸`, `related: [[zet‸`, `related: "[[zet‸` — then
  nothing: core reads no tag or wikilink there. Given `tags: pk‸` below the
  closing `---`, then nothing; `tags: #pk‸` there is an ordinary tag.
  _verify: unit_

- **AC-8**: In VS Code, link, section, block-anchor and tag completion
  (frontmatter included, with a typed `#` removed on accept) are offered
  exactly where AC-1 to AC-7 find something, and replace only what was
  typed: `[[a [[b‸` replaces `a [[b`. `link-completion.spec.ts` and
  `tag-completion.spec.ts` keep passing unchanged.
  _verify: e2e_

- **AC-9**: In the mobile app, capture and the editor suggest notes for a
  link and tags for a tag, exactly where AC-1 to AC-7 find one; while a
  section or block anchor is typed they suggest nothing. In Source mode,
  given `tags: #pk‸` in frontmatter, picking `pkm` writes `tags: pkm`.
  _verify: unit_

- **AC-10**: No host keeps a pattern of its own for what is being typed at
  the cursor; the cases the hosts test today for it are covered by core's
  tests.
  _verify: human_

## Out of scope

- **Suggestion lists, ranking and what picking writes.** VS Code leaves
  filtering to the editor and inserts inside the brackets; the app ranks with
  `suggestNotes`/`suggestTags` and swallows a following `]]`. Those are UI
  and stay with each host.
- **Section and block suggestions on mobile.** The app gains none here (AC-9
  only stops it suggesting notes for a section).
- **Code and HTML.** Completion still works inside inline code, code blocks
  and HTML blocks, where core reads no link or tag, as both hosts do today.
  Telling those apart needs block context from before the cursor's line: a
  fence opened earlier, indented code against a list item's continuation.
  Getting it from core's parser meant parsing everything before the cursor
  on each call, 7, 24 and 100 ms at 250, 1000 and 4000 lines against well
  under a millisecond for the rules, measured on a laptop. A follow-up can
  parse only the cursor's block.
- **Markdown links** (`[text](‸`), and completion triggers — which keystrokes
  open the list is each editor's business.
