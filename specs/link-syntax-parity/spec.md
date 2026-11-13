---
type: feature
created: 2026-11-13
---

# Treat wikilinks and markdown links alike when renaming

## Context

Foam identifies a section by the heading's exact text. The rest of the markdown
world — GitHub, VS Code's own markdown support, static site generators —
identifies it by the heading's slug, the lowercase hyphenated form. So
`[[note#My Section]]` and `[text](note.md#my-section)` name the same heading,
but Foam recognises only the first as a reference to a section. The second
resolves to the note and no further, so go-to-definition stops at the top of
the file and a rename passes it by.

That split shows up as inconsistent renames. VS Code asks each rename provider
in turn and takes the first one that answers; edits from two providers are
never combined. Whichever of Foam and the built-in markdown support claims a
rename therefore owns every link in it. Foam claims a rename started on a
heading or on a wikilink's `#section`, and leaves slug-form markdown links
stale. The built-in claims one started on a markdown link's `#fragment`, and
leaves wikilinks stale. Three ways to start the same rename, three different
results, and in a workspace that mixes both syntaxes each one breaks something.

Renaming a _note_ mostly works the way we want, by a different route: the file
rename reaches both Foam and VS Code as an event, so a rename started from the
explorer or from a markdown link's path updates wikilinks and markdown links
alike. The exception is F2 on a wikilink's target, which Foam does not claim:
the built-in reads `[[note-a]]` as a reference link and rewrites the link text
without renaming any file, so the link breaks. [#1772] was the same confusion
for sections.

Taking the markdown-link cases over from VS Code is a deliberate trade. Foam
becomes responsible for behaviour it currently inherits, and gets consistency
in return.

[#1772]: https://github.com/foambubble/foam/issues/1772

## Acceptance criteria

### Finding the section a link points at

- **AC-1**: Given `## My Section` in `note-a`, when go-to-definition runs on
  `[text](note-a.md#my-section)`, then the editor opens `note-a` with the
  cursor on that heading, as it already does for `[[note-a#My Section]]`.
  _verify: e2e_

- **AC-2**: Given two headings whose text differs but whose slug is the same,
  when a link names one of them exactly, then that heading is the match.
  _verify: unit_

- **AC-3**: Given two headings that share a slug, when a link matches neither
  exactly, then it resolves to no section, and renaming either heading leaves
  that link untouched.
  _verify: unit_

### Renaming a section

- **AC-4**: Given a section linked by `[[note-a#My Section]]`,
  `[text](<note-a.md#My Section>)` and `[text](note-a.md#my-section)`, when the
  section is renamed, then all three still point at it, and each keeps the
  syntax it was written in — the first two carry the new heading text, the
  third carries the new slug.
  _verify: unit_

- **AC-5**: Given that workspace, when the rename is started from the heading,
  from the wikilink's `#section`, or from either markdown link's `#fragment`,
  then all four starting points produce the same edits.
  _verify: unit_

- **AC-6**: Given the cursor on a markdown link's `#fragment`, when rename is
  invoked, then Foam performs it: the heading changes, and the wikilinks
  pointing at it change with it.
  _verify: e2e_

- **AC-7**: One test covers AC-4 and AC-5 as a matrix — every starting point
  against every link syntax — so that a new syntax or a new starting point has
  one obvious place to be added.
  _verify: unit_

### Renaming a note

- **AC-8**: Given the cursor on `[[note-a]]`, when rename is invoked, then the
  file is renamed and both the wikilinks and the markdown links pointing at it
  are updated.
  _verify: e2e_

- **AC-9**: Given a note linked by both syntaxes, when it is renamed from the
  explorer, from a wikilink's target, or from a markdown link's path, then the
  file and every link to it end in the same state.
  _verify: e2e_

## Out of scope

- **Reporting a broken markdown link.** The unknown-section diagnostic examines
  wikilinks only. Extending it would raise warnings on workspaces that have
  never seen them, which deserves its own decision.
- **What completion inserts.** Section completion keeps offering the heading
  text rather than the slug.
- **Block anchors.** `#^blockid` is Foam's own syntax with no slug form, so
  nothing about it changes.
- **Starting a rename on a link reference definition.** A `[text][ref]` link
  keeps its fragment on its `[ref]: note.md#section` line, so the link itself
  has no fragment under the cursor, and a rename started on the definition
  line still falls to VS Code. Those definitions are rewritten when a rename
  runs from anywhere else.
- **The form Foam writes when converting a link.** Turning a wikilink into a
  markdown link still produces `[text](<note.md#My Section>)`, which resolves
  in Foam but not on GitHub. Whether Foam should write a slug there is a
  separate question.

## Open questions

- **What does F2 on a wikilink's target do today, exactly?** Reading VS Code's
  markdown support says it rewrites the link text and renames nothing, which
  matches what [#1772] reported for sections. That comes from reading the code,
  not from trying it; the first failing test for AC-8 will settle it.
- **This spec is tracked rather than local.** The procedure puts a spec with no
  issue behind it in `specs.local/`, but the work has been agreed, so it starts
  in `specs/`.
