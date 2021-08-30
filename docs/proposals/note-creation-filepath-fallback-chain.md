# Templates v2 Proposal <!-- omit in TOC -->

- [Introduction](#introduction)
- [Goals](#goals)
- [Proposal: "New note" path resolution](#proposal-new-note-path-resolution)
  - [Phase 1: `<workspace>/.foam/templates/new-note.md`](#phase-1-workspacefoamtemplatesnew-notemd)
  - [`foam.rootDirectory`](#foamrootdirectory)
  - [Phase 2: `${foam.rootDirectory ?? <home_dir>}/.foam/templates/new-note.md`](#phase-2-foamrootdirectory--home_dirfoamtemplatesnew-notemd)
  - [Phase 3: `foam.rootDirectory`](#phase-3-foamrootdirectory)
  - [Phase 4: Use the directory of the active editor](#phase-4-use-the-directory-of-the-active-editor)
  - [Phase 5: Use the workspace root](#phase-5-use-the-workspace-root)
  - [Phase 6: `foam.rootDirectory ?? <home_dir>`](#phase-6-foamrootdirectory--home_dir)
- [Progression of Foam usage maturity](#progression-of-foam-usage-maturity)

## Introduction

This document aims to standardize the fallback chain that is used by Foam when determining where to create a new note.
Currently, each command has its own fallback chain, which leads to inconsistent behaviour in Foam.

This document will guide the development direction that each note-creating-command will eventually be modified to follow.

Note that throughout this doc, `foam.rootDirectory` is used as a placeholder name to denote a new Foam setting that we would add.

## Goals

* 100% coverage: Define a fallback chain such that Foam should always know where to / have a place to create a note
* Sensible UX: Simplicity and consistency: it does what the user expects, and covers their needs without undue complexity.
* Progressive UX: Users start with sensible defaults, then can customize as their usage of Foam gets more sophisticated.

## Proposal: "New note" path resolution

### Phase 1: `<workspace>/.foam/templates/new-note.md`

If `<workspace>/.foam/templates/new-note.md` exists, parse it looking for `filepath`:

* A relative path in `filepath` in `<workspace>/.foam/templates/new-note.md` should be relative to the workspace.
  * **Justification:** Allows users to have customized templates in a given workspace.
* An absolute path in `filepath` in `<workspace>/.foam/templates/new-note.md` should just use that absolute path.
  * **Justification:** Allows uses to have their notes for a project inside another repository.

### `foam.rootDirectory`

`foam.rootDirectory` is a new Foam setting that we would add. It would be a directory that will be used for finding all global Foam-related settings.
For some users, this might be the directory of their "second brain" / Zettelkasten repository.
If not explicitly set, then Foam would look for the global Foam-related settings in the user's home directory (e.g., `~` on Linux/Mac), as discussed in [this comment](https://github.com/foambubble/foam/issues/670#issuecomment-860184377).
### Phase 2: `${foam.rootDirectory ?? <home_dir>}/.foam/templates/new-note.md`

If `<workspace>/.foam/templates/new-note.md` does not exist (or no `filepath` attribute is defined in it), fall back to `${foam.rootDirectory ?? <home_dir>}/.foam/templates/new-note.md`

**Justification:** Allows users to define templates that can be used globally.

* An absolute path in `filepath` in `${foam.rootDirectory ?? <home_dir>}/.foam/templates/new-note.md` should just use that absolute path.
* A relative path in `filepath` in `${foam.rootDirectory ?? <home_dir>}/.foam/templates/new-note.md` should result in:
  * Relative to the current workspace (~Phase 5)
    * **Justification:** This allows you to always store notes in a `notes` subdirectory of each project, etc.
  * then relative to `foam.rootDirectory ?? <home_dir>` (~Phase 6) in the edge case where no workspace is open.
    * **Justification:** Mostly here just to have a reasonable fallback in this edge case. It's kinda as if your Foam root directory is a default workspace.

### Phase 3: `foam.rootDirectory`

If `${foam.rootDirectory ?? <home_dir>}/.foam/templates/new-note.md` does not exist (or no `filepath` attribute is defined in it), fall back to directory defined in `foam.rootDirectory`.

**Justification:** This allows users to define a global directory to hold all Foam-related stuff (e.g., a second brain repository).
### Phase 4: Use the directory of the active editor

If `foam.rootDirectory` is not defined, then use the directory of the active editor (`dirname(vscode.window.activeTextEditor)`).
This matches the behaviour of what [Markdown Notes'](https://marketplace.visualstudio.com/items?itemName=kortina.vscode-markdown-notes) `SAME_AS_ACTIVE_NOTE` does.

### Phase 5: Use the workspace root

If there is no active note, then use the workspace root (`workspace.workspaceFolders[0].uri`)

This matches the behaviour of what [Markdown Notes'](https://marketplace.visualstudio.com/items?itemName=kortina.vscode-markdown-notes) `WORKSPACE_ROOT` does.

**Justification:** A reasonable fallback in the edge case where there isn't a file open.

### Phase 6: `foam.rootDirectory ?? <home_dir>`

In the case where there is also no workspace open, then use `foam.rootDirectory ?? <home_dir>`.

**Justification:** A reasonable fallback in the edge case where there isn't a workspace open. It's as if your Foam root directory is a default workspace.

Markdown Notes doesn't handle this case well, creating the note in the directory where VSCode was started from (???) and then failing to open the note.

## Progression of Foam usage maturity

* When users first start using Foam, they have set up nothing. They skip to Phase 4.
* They then might decide they want to set a global location where they store their notes (e.g., a second brain repository)
  * They then define `foam.rootDirectory`, which means that they use Phase 3.
* Then they might get into templates, which allow the fine-grain control of Phases 1 and 2:
  * At first, they'll probably set them up in `foam.rootDirectory` to control their notes globally (Phase 2)
  * For finer grain control, they Set up overrides of the global templates on a per-workspace level (Phase 1)
