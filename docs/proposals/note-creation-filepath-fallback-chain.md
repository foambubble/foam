# Templates v2 Proposal <!-- omit in TOC -->

- [Introduction](#introduction)
- [Proposal: "New note" path resolution](#proposal-new-note-path-resolution)
  - [Phase 1: `<workspace>/.foam/templates/new-note.md`](#phase-1-workspacefoamtemplatesnew-notemd)
  - [Phase 2: `<home_dir>/.foam/templates/new-note.md`](#phase-2-home_dirfoamtemplatesnew-notemd)
  - [Phase 3: `foam.newNoteDirectory`](#phase-3-foamnewnotedirectory)
  - [Phase 4: Use the directory of the active editor](#phase-4-use-the-directory-of-the-active-editor)
  - [Phase 5: Use the workspace root](#phase-5-use-the-workspace-root)
  - [Phase 6: `<home_dir>`](#phase-6-home_dir)
- [Progression of Foam usage maturity](#progression-of-foam-usage-maturity)

## Introduction

This document aims to standardize the fallback chain that is used by Foam when determining where to create a new note.
Currently, each command has its own fallback chain, which leads to inconsistent behaviour in Foam.

This document will guide the development direction that each note-creating-command will eventually be modified to follow.

Note that throughout this doc, `foam.newNoteDirectory` is used as a placeholder to denote a new Foam setting that we would add, as discussed in [this comment](https://github.com/foambubble/foam/issues/670#issuecomment-860184377).

## Proposal: "New note" path resolution

### Phase 1: `<workspace>/.foam/templates/new-note.md`

If `<workspace>/.foam/templates/new-note.md` exists, parse it looking for `filepath`:

* An absolute path in `filepath` in `<workspace>/.foam/templates/new-note.md` should just use that absolute path.
* A relative path in `filepath` in `<workspace>/.foam/templates/new-note.md` should be relative to the workspace.

### Phase 2: `<home_dir>/.foam/templates/new-note.md`

If `<workspace>/.foam/templates/new-note.md` does not exist (or no `filepath` attribute is defined in it), fall back to `<home_dir>/.foam/templates/new-note.md`

* An absolute path in `filepath` in `<home_dir>/.foam/templates/new-note.md` should just use that absolute path.
* A relative path in `filepath` in `<home_dir>/.foam/templates/new-note.md` should result in:
  * **Option A**: Relative to the home directory
    * This behaviour matches `<workspace>/.foam/templates/new-note.md` behaviour
  * **Option B**: Relative to `foam.newNoteDirectory`
    * I suspect is what you'd expect if you've already defined `foam.newNoteDirectory`
  * **Option C**: Both. Relative to `foam.newNoteDirectory`, only when `foam.newNoteDirectory` is defined. Otherwise, relative to `<home_dir>`
    * Things get a little weird if you didn't have `foam.newNoteDirectory` defined, then later defined it.
  * **Option D**: Its own fallback chain:
    * Relative to `foam.newNoteDirectory`, if defined
    * Relative to workspace, if a workspace is open
    * Relative to the home directory
    * **Note:** This is similar to Phases 3, 5, and 6. But it doesn't make sense to include Phase 4 in this chain.

### Phase 3: `foam.newNoteDirectory`

If `<home_dir>/.foam/templates/new-note.md` does not exist (or no `filepath` attribute is defined in it), fall back to `foam.newNoteDirectory`.

`foam.newNoteDirectory` should be a filepath, matching the spec used for `filepath` in the templates:
  * Consistency: with the behaviour of the existing template commands.
  * Flexibility: Users could use variables like `$FOAM_TITLE` (and eventually other snippet variables) in the path.

### Phase 4: Use the directory of the active editor

If `foam.newNoteDirectory` is not defined, then use the directory of the active editor (`dirname(vscode.window.activeTextEditor)`).
This matches the behaviour of what [Markdown Notes'](https://marketplace.visualstudio.com/items?itemName=kortina.vscode-markdown-notes) `SAME_AS_ACTIVE_NOTE` does.

### Phase 5: Use the workspace root

If there is no active note, then use the workspace root (`workspace.workspaceFolders[0].uri`)

This matches the behaviour of what [Markdown Notes'](https://marketplace.visualstudio.com/items?itemName=kortina.vscode-markdown-notes) `WORKSPACE_ROOT` does.

### Phase 6: `<home_dir>`

In the case where there is also no workspace open, then use `<home_dir>`.

Markdown Notes doesn't handle this case well, creating the note in the directory where VSCode was started from (???) and then failing to open the note.

## Progression of Foam usage maturity

* When users first start using Foam, they have set up nothing. They skip to Phase 4.
* They might then define `foam.newNoteDirectory` which means that they use Phase 3.
* Then they might get into templates, which allow the fine-grain control of Phases 1 and 2.
