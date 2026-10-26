---
issue: 1742
type: feature
created: 2026-10-26
---

# Open notes in the editor the user associated with Markdown

## Context

[Issue #1742](https://github.com/foambubble/foam/issues/1742) comes from
someone who made VS Code's built-in Markdown Editor (`vscode.markdown.editor`,
from 1.135) their default for `.md` files through
`workbench.editorAssociations`. Their report has two halves: notes opened by
Foam land in the plain Text Editor whatever the association, and `[[` does
not trigger wikilink completion inside the Markdown Editor.

**Most of Foam already honors the association.** Open Resource, every Foam
tree view, the graph and note creation on an existing file all open through
`vscode.open`, which resolves `workbench.editorAssociations`. So does
following a wikilink: ctrl/cmd+click and `F12` run Go to Definition, which
opens its target through the same editor resolution. On 1.136, `F12` on a
wikilink opens the Markdown Editor when it is associated.

Four commands do not, and they are the bug: Open Daily Note and Open Daily
Note for Date re-open an existing note as a text document after it has
already been opened, and Open Random Note and Show Similar Notes open a text
document directly.

Wikilinks must stay definition-only. VS Code runs a document link and Go to
Definition on the same click, with no check against each other. A plain click
hides it, because opening the link in the same group cancels the definition
jump, but ctrl/cmd+alt+click opens two editors beside the current one. A link
next to the definition buys nothing and costs that.

The reporter's editor needs VS Code 1.135, newer than the `^1.110.0` this
extension declares. Moving to 1.136 (`@types/vscode` has no 1.135) lets the
e2e suite run against the real Markdown Editor, and makes the completion half
of the issue answerable.

## Acceptance criteria

- **AC-1**: Given `workbench.editorAssociations` associates `*.md` with an
  editor other than the default text editor, when a note is opened by Open
  Daily Note, Open Daily Note for Date, Open Random Note, Open Resource,
  selecting a note in a Foam tree view, or Show Similar Notes, then the note
  opens in the associated editor.
  _verify: e2e_ (Show Similar Notes: _human_ — the test host does not
  activate the AI features)

- **AC-2**: Given the same association, when a wikilink to an existing note
  is followed with Go to Definition, then the target opens in the associated
  editor, and `[[note#Section]]` puts the cursor on the section when it opens
  in the text editor.
  _verify: e2e_ for Go to Definition, _human_ for ctrl/cmd+click

- **AC-3**: Given a note is open in an associated non-text editor and is the
  active tab, when Foam features that act on the current note run (the
  backlinks and connections panels, tag views, related notes), then they
  resolve that note.
  _verify: unit_

- **AC-4**: Given no editor association for Markdown, when any path in AC-1
  or AC-2 opens a note, then the note opens in the text editor as it does
  today, and a daily note created for the first time opens with the cursor at
  the end of the file.
  _verify: e2e_

- **AC-5**: Given an editor association for Markdown, when a note is created
  from a template (Create New Note From Template, or a daily note created for
  the first time), then it still opens in a text editor and the template's
  placeholders and tab stops work. Snippet insertion has no equivalent outside
  a text editor.
  _verify: e2e_

- **AC-6**: Given this change ships, then `engines.vscode` and `@types/vscode`
  declare 1.136, and the e2e suite runs on a 1.136 host on Linux and macOS.
  _verify: e2e_

- **AC-7**: Given a note open in the built-in Markdown Editor, when `[[` is
  typed and when a wikilink is hovered, then Foam's completion and hover
  appear if VS Code routes extension language features into that editor;
  otherwise the user docs say what does not work there.
  _verify: human_

## Out of scope

- **A Foam setting to choose which editor notes open in**, offered in the
  issue as an alternative. `workbench.editorAssociations` is the platform's
  mechanism for this; a `foam.*` setting would be a second source of truth.
- **Opening a Foam template or a smart folder definition for editing.** Those
  are source text; they stay in the text editor.
- **Following `[[#Section]]` within a note from the text editor.** With an
  association, it opens the note in the associated editor: Go to Definition
  reopens the file through the association even for the same note, and VS
  Code's own `[text](#heading)` links do the same. The user docs say so.
- **Ctrl/cmd+alt+click on `[text](note.md#section)` opening two editors.**
  VS Code's own link and Foam's definition both open to the side. It is not
  caused by this change, and dropping Foam's definition for direct links
  would cost `F12` and folder links.

## AC-7 finding

Settled on a 1.136 host: **extension completion and hover do not reach the
built-in Markdown Editor, and VS Code offers no API that would let them.** The
editor is a `CustomTextEditorProvider` that renders into a webview, so there is
no `TextEditor` for it — `window.activeTextEditor` is `undefined` while it is
focused — and VS Code's completion and hover UI belongs to the text editor.
Its own extension points (`linkPresentationProviders`, embedded code-block
editors) sit behind proposed APIs a Marketplace extension cannot enable.
Checked by hand on the same host: inside it, wikilinks are plain text rather
than links, and `![[embeds]]` are not rendered.

What keeps working, because the editor edits the same `TextDocument`: indexing,
the graph, the Connections and Tags panels, backlinks, linting, link syncing on
rename. The user docs describe the split: write and follow links in the text
editor, read in the Markdown Editor.
