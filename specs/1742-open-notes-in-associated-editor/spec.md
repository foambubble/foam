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
does not trigger wikilink completion inside that editor. Both halves are in
scope.

Honoring `workbench.editorAssociations` is already a settled expectation in
Foam: [#1675](https://github.com/foambubble/foam/issues/1675) made wikilinks
and reference-style links to attachments open through the platform's own open
mechanism precisely so that per-user and per-workspace associations decide the
editor.

**Most note-opening paths already delegate to VS Code and already honor the
association.** Open Resource, every Foam tree view (backlinks, orphans, tags,
placeholders, smart folders), the graph view, and opening an existing note
from a wikilink placeholder all hand the URI to VS Code's own open command.
Three paths do not, and they are the bug:

- Open Daily Note, Open Daily Note for Date and Open Random Note open the
  file as a text document directly, which forces the Text Editor by
  construction.
- Show Similar Notes does the same thing.
- A wikilink to an existing note is surfaced to VS Code as a *definition*, and
  "go to definition" always lands in a text editor.

That last one is why the fix is not purely mechanical: activating a wikilink
and asking VS Code for a definition are the same gesture (ctrl/cmd+click), and
the definition is also what `F12` and Peek Definition work from. So Foam offers
**both** on a wikilink — the definition it offers today, and a document link
invoking the platform's open command. Which of the two the workbench follows on
a click is its own decision, not something an extension can observe or
influence, so AC-2 is specified at what Foam controls and the gesture itself is
a human check. The point of offering both is that nothing a user has today is
taken away: if the workbench prefers the definition, the click lands in a text
editor exactly as it always has.

The machinery Foam uses to answer "which note am I on" already copes with tabs
that are not text editors (custom editors and notebooks included), so the rest
of Foam is not expected to go blind when a note opens in an associated editor
— AC-3 holds that to account.

The reporter's editor needs VS Code 1.135, newer than the `^1.110.0` this
extension declares and the 1.110.0 the e2e host pins. **Updating both to 1.135
is part of this work** (AC-7), which is what lets the reporter's exact
configuration be an automated test rather than a manual check, and what makes
the completion-and-hover half of the issue answerable at all.

## Acceptance criteria

- **AC-1**: Given `workbench.editorAssociations` associates `*.md` with an
  editor other than the default text editor, when a note is opened by a Foam
  command — Open Daily Note, Open Daily Note for Date, Open Random Note, Open
  Resource, selecting a note in a Foam tree view (backlinks, orphans, tags,
  smart folders), or Show Similar Notes — then the note opens in the
  associated editor rather than being forced into the text editor.
  _verify: e2e_ (Show Similar Notes excepted: the test host does not activate
  the AI features, so that one path is verified by AC-6's manual sweep)

- **AC-2**: Given the same association, when a wikilink that resolves to an
  existing note is activated through the document link Foam provides for it,
  then the target note opens in the associated editor, and `[[note#Section]]`
  lands on the section.
  _verify: e2e_

- **AC-2b**: Given the same association, when the wikilink is ctrl/cmd+clicked
  in the running editor, then the target opens in the associated editor if the
  workbench follows the document link rather than the definition. Both are
  offered at the same range and the choice is the workbench's, above any API a
  test can call, so this is checked by hand once. A negative outcome is today's
  behavior, not a regression — AC-4 is what guarantees that.
  _verify: human_

- **AC-3**: Given a note is open in an associated non-text editor and is the
  active tab, when Foam features that act on the current note run — the
  backlinks and connections panels, tag views, related notes — then they
  resolve that note, as they do today for other non-text editor tabs.
  _verify: unit_

- **AC-4**: Given no editor association for Markdown, when any of the paths in
  AC-1 and AC-2 open a note, then the note opens in the text editor as it does
  today, and a daily note created for the first time still opens with the
  cursor at the end of the file.
  _verify: e2e_

- **AC-5**: Given an editor association for Markdown is configured, when a
  note is created from a template (Create New Note From Template, or a daily
  note created for the first time), then the new note still opens in a text
  editor and the template's snippet placeholders and tab stops still work —
  creation deliberately does not follow the association, because snippet
  insertion has no equivalent outside a text editor.
  _verify: e2e_

- **AC-6**: Given VS Code with `workbench.editorAssociations` set to the
  built-in Markdown Editor, when Open Daily Note runs and when a wikilink to
  an existing note is activated, then the note opens in the Markdown Editor.
  This is the reporter's configuration; with AC-7 done it runs in the e2e
  host, and Show Similar Notes is swept by hand in the same pass.
  _verify: e2e_

- **AC-7**: Given this change ships, then `engines.vscode` and
  `@types/vscode` declare 1.135 or later, the e2e host runs that version, and
  the full unit and e2e suites pass on it.
  _verify: e2e_

- **AC-8**: Given a wikilink to an existing note in the text editor, with or
  without an editor association configured, when the link is hovered, when
  `F12` is pressed on it and when Peek Definition is invoked on it, then all
  three behave as they do today: Foam still provides the definition those two
  work from, alongside the new document link.
  _verify: e2e_

- **AC-9**: Given a note open in the built-in Markdown Editor, when `[[` is
  typed and when a wikilink is hovered, then Foam's wikilink completion and
  hover appear if VS Code routes extension language features into that editor.
  Whether it does is settled by investigation on 1.135, not assumed: the
  outcome is either working completion and hover there, or a written finding
  in this spec and in the user documentation saying what the editor does not
  support and what evidence says so. Foam's registration already covers the
  document (`{ language: 'markdown', scheme: 'file' }`), so a negative outcome
  is a platform limitation, not a Foam gap to fix.
  _verify: human_

## Out of scope

- **A Foam setting to choose which editor notes open in**, offered as an
  alternative in the issue. `workbench.editorAssociations` is the platform's
  mechanism for exactly this, and a parallel `foam.*` setting would be a
  second source of truth for the same decision.
- **Opening a Foam template for editing** (Edit Template and friends), and
  editing a smart folder's query definition. Those are source text with
  `$FOAM_` variables in them; they stay in the text editor.
- **The built-in Markdown preview** (Ctrl+K V) and Foam's own preview
  behavior. Unchanged.
- **Making Foam features work inside editors that give extensions no API to
  work with.** AC-9 covers using what is available and documenting what is
  not; building a Foam-side live-preview editor is a different piece of work.

## AC-9 finding

Settled on a 1.136.0 host (see Open questions for why 1.136): **extension
completion and hover do not reach the built-in Markdown Editor, and VS Code
offers no API that would let them.** The editor is a `CustomTextEditorProvider`
(`vscode.markdown.editor`) that renders into a *webview*, so there is no
`TextEditor` for it — `window.activeTextEditor` is `undefined` while it is
focused, which `editor.spec.ts` asserts — and VS Code's completion and hover UI
belongs to the text editor widget. The editor's own extension points
(`linkPresentationProviders`, embedded code-block editors) sit behind proposed
APIs the bundled extension enables for itself (`linkPresentation`,
`customEditorDiffs`, `documentSyntaxHighlighting`); a Marketplace extension
cannot enable those, so there is nothing available to build on.

What does keep working, because the editor edits the same `TextDocument`:
indexing, the graph, the Connections and Tags panels, backlinks, linting, link
syncing on rename — everything that reads notes rather than typing into them.
Foam's registration (`{ language: 'markdown', scheme: 'file' }`) was already
correct for it, so nothing on Foam's side is missing. The limitation and the
editing/reading split are written into
`docs/user/features/wikilinks.md`.

## Open questions

- ~~Honoring the association for wikilink activation (AC-2) costs Peek
  Definition on a wikilink~~ — settled on the PR: **nothing is given up**. The
  first implementation dropped the wikilink definition, on the belief that a
  definition and a document link cannot coexist at one range. That belief was a
  generalisation of a comment about two *definition* providers colliding and was
  never established, so it was not a cost worth paying blind. Foam now emits
  both: `F12`, Peek Definition and the hover preview are untouched for every
  user, and the document link gives the workbench the chance to honor the
  association. Which it follows on a click is AC-2b, checked by hand — and a
  negative answer costs nothing, because it is today's behavior.
- ~~The Markdown Editor's `viewType`, and whether it is a custom editor at
  all~~ — `vscode.markdown.editor`, a custom text editor over the same
  `TextDocument`. Read off the host, and now the association the e2e suite
  runs AC-1, AC-2 and AC-6 against.
- The version is **1.136.0**, not 1.135: `@types/vscode` has no 1.135.0
  published, and `engines.vscode` should match the types the code compiles
  against. AC-7 asks for "1.135 or later".
