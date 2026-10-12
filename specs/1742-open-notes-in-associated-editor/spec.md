---
issue: 1742
type: feature
created: 2026-10-12
---

# Open notes in the editor the user associated with Markdown

## Context

[Issue #1742](https://github.com/foambubble/foam/issues/1742) comes from
someone who set a non-default editor as the default for `.md` files through
`workbench.editorAssociations` — in their case VS Code's built-in Markdown
Editor, the render-as-you-type mode they are reaching for after Obsidian's
live preview. Their report has two halves: Foam's note-opening commands
ignore the association and always land in the plain Text Editor, and `[[`
does not trigger wikilink completion inside that editor. This spec covers the
first half only; see Out of scope for why the second is not here.

Honoring `workbench.editorAssociations` is already a settled expectation in
Foam: [#1675](https://github.com/foambubble/foam/issues/1675) made wikilinks
and reference-style links to attachments open through the platform's own
open mechanism precisely so that per-user and per-workspace associations
decide the editor. Note-opening is the part that was left behind — opening a
daily note, a random note, a note from a Foam tree view, or following a
wikilink to a note all end up in a text editor regardless of the setting. The
machinery Foam uses to answer "which note am I on" already copes with tabs
that are not text editors (custom editors and notebooks included), so the
rest of Foam is not expected to go blind when a note opens in an associated
editor — AC-3 holds that to account.

The VS Code version the reporter names (1.135) is newer than the one this
extension declares (`engines.vscode: ^1.110.0`) and newer than the one the
e2e host runs (1.110.0), so the built-in Markdown Editor cannot be driven by
an automated test here. The behavior below is therefore specified against
*any* editor association, which is what Foam actually has to respect, with
one human check against the editor the reporter asked about.

## Acceptance criteria

- **AC-1**: Given `workbench.editorAssociations` associates `*.md` with an
  editor other than the default text editor, when a note is opened by a Foam
  command — Open Daily Note, Open Daily Note for Date, Open Random Note, Open
  Resource, selecting a note in a Foam tree view (backlinks, orphans, tags,
  smart folders), or Show Similar Notes — then the note opens in the
  associated editor rather than being forced into the text editor.
  _verify: e2e_

- **AC-2**: Given the same association, when a wikilink that resolves to an
  existing note is activated from a note (ctrl/cmd+click or the keyboard
  equivalent), then the target note opens in the associated editor.
  _verify: e2e_

- **AC-3**: Given a note is open in an associated non-text editor and is the
  active tab, when Foam features that act on the current note run — the
  backlinks and connections panels, tag views, and Open Daily Note deciding
  whether today's note is already open — then they resolve that note, as they
  do today for other non-text editor tabs.
  _verify: unit_

- **AC-4**: Given no editor association for Markdown, when any of the paths
  in AC-1 and AC-2 open a note, then behavior is unchanged from today: the
  note opens in the text editor, and the daily note still opens with the
  cursor at the end of the file.
  _verify: e2e_

- **AC-5**: Given an editor association for Markdown is configured, when a
  note is created from a template (Create New Note From Template, or a
  daily note created for the first time), then the new note still opens in a
  text editor and the template's snippet placeholders and tab stops still
  work — creation deliberately does not follow the association, because
  snippet insertion has no equivalent outside a text editor.
  _verify: e2e_

- **AC-6**: Given VS Code 1.135 or later with `workbench.editorAssociations`
  set to the built-in Markdown Editor, when Open Daily Note runs and when a
  wikilink to an existing note is activated, then the note opens in the
  Markdown Editor. This is the reporter's actual configuration and cannot be
  exercised by the pinned e2e host, so somebody runs it before merge.
  _verify: human_

## Out of scope

- **Wikilink completion and hover previews inside the Markdown Editor** — the
  issue's first bullet. Whether an extension's completion and hover providers
  can participate in that editor at all is a question about VS Code 1.135's
  API that cannot be answered from this repository, at this engine version,
  without the editor in hand; and nothing in this spec moves it either way.
  Writing acceptance criteria for it would be a promise nobody has checked.
  It needs its own investigation first — see Open questions.
- **A Foam setting to choose which editor notes open in**, offered as an
  alternative in the issue. `workbench.editorAssociations` is the platform's
  mechanism for exactly this, and a parallel `foam.*` setting would be a
  second source of truth for the same decision.
- **Opening a Foam template for editing** (Edit Template and friends).
  Templates are source text with `$FOAM_` variables in them; they stay in the
  text editor.
- **The built-in Markdown preview** (Ctrl+K V) and Foam's own preview
  behavior. Unchanged.

## Open questions

- Honoring the association for wikilink activation (AC-2) may cost the
  editor behaviors that come with treating a wikilink as a definition —
  Peek Definition on a wikilink, and the multi-target picker. Is opening in
  the chosen editor worth losing peek-in-place? Assumed yes: a user who has
  set an association has said which editor they want, and peek is reachable
  from the backlinks and connections views. Worth confirming with the
  reporter, and worth settling before implementation.
- Should the completion-and-hover half become its own spike (can extension
  language features participate in the built-in Markdown Editor, and does
  Foam need an engine bump to find out)? Assumed yes, as a separate issue, so
  this spec can ship the half that is verifiable today. It is the half the
  reporter listed first, so saying nothing about it is not an option.
- AC-6 needs a VS Code 1.135+ install. If no maintainer has one at review
  time, the honest outcome is to merge AC-1..AC-5 and leave AC-6 open on the
  issue rather than tick it unverified.
