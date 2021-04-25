# Templates v2 Proposal <!-- omit in TOC -->

The current capabilities of templates is limited in some important ways. This document aims to propose a design that addresses these shortcomings.

**IMPORTANT: This design is merely a proposal of a design that could be implemented. It DOES NOT represent a commitment by `Foam` developers to implement the features outlined in this document. This document is merely a mechanism to facilitate discussion of a possible future direction for `Foam`.**

- [Introduction](#introduction)
- [Limitations of current templating](#limitations-of-current-templating)
  - [Too much friction to create a new note](#too-much-friction-to-create-a-new-note)
    - [Manual note creation (Mouse + Keyboard)](#manual-note-creation-mouse--keyboard)
    - [Manual note creation (Keyboard)](#manual-note-creation-keyboard)
    - [Foam missing note creation](#foam-missing-note-creation)
    - [`Markdown Notes: New Note` (Keyboard)](#markdown-notes-new-note-keyboard)
    - [Foam template note creation (Keyboard)](#foam-template-note-creation-keyboard)
  - [Templating of daily notes](#templating-of-daily-notes)
  - [Templating of filepaths](#templating-of-filepaths)
- [Goal / Philosophy](#goal--philosophy)
- [Proposal](#proposal)
  - [Summary](#summary)
  - [Add a `${title}` and `${titleSlug}` template variables](#add-a-title-and-titleslug-template-variables)
  - [Add a `Foam: Create New Note` command and hotkey](#add-a-foam-create-new-note-command-and-hotkey)
    - [Case 1: `.foam/templates/new-note.md` doesn't exist](#case-1-foamtemplatesnew-notemd-doesnt-exist)
    - [Case 2: `.foam/templates/new-note.md` exists](#case-2-foamtemplatesnew-notemd-exists)
  - [Change missing wikilinks to use the default template](#change-missing-wikilinks-to-use-the-default-template)
  - [Add a metadata section to templates](#add-a-metadata-section-to-templates)
    - [Example](#example)
  - [Add a replacement for `dateFormat`](#add-a-replacement-for-dateformat)
  - [Add support for daily note templates](#add-support-for-daily-note-templates)
  - [Eliminate all `foam.openDailyNote` settings](#eliminate-all-foamopendailynote-settings)
- [Summary: resulting behaviour](#summary-resulting-behaviour)
  - [`Foam: Create New Note`](#foam-create-new-note)
  - [`Foam: Open Daily Note`](#foam-open-daily-note)
  - [Navigating to missing wikilinks](#navigating-to-missing-wikilinks)
  - [`Foam: Create Note From Template`](#foam-create-note-from-template)
- [Extensions](#extensions)
  - [More variables in templates](#more-variables-in-templates)
  - [`defaultFilepath`](#defaultfilepath)
  - [Arbitrary hotkey -> template mappings?](#arbitrary-hotkey---template-mappings)

## Introduction

Creating of new notes in Foam is too cumbersome and slow. Despite their power, Foam templates can currently only be used in very limited scenarios.

This proposal aims to address these issues by streamlining note creation and by allowing templates to be used everywhere.

## Limitations of current templating

### Too much friction to create a new note

Creating new notes should an incredibly streamlined operation. There should be no friction to creating new notes.

Unfortunately, all of the current methods for creating notes are cumbersome.

#### Manual note creation (Mouse + Keyboard)

1. Navigate to the directory where you want the note
2. Click the new file button
3. Provide a filename
4. Manually enter the template contents you want

#### Manual note creation (Keyboard)

1. Navigate to the directory where you want the note
2. `⌘N` to create a new file
3. `⌘S` to save the file and give it a filename
4. Manually enter the template contents you want

#### Foam missing note creation

1. Open an existing note in the directory where you want the note
2. Use the wikilinks syntax to create a link to the title of the note you want to have
3. Use `Ctrl+Click`/`F12` to create the new file
4. Manually enter the template contents you want

#### `Markdown Notes: New Note` (Keyboard)

1. Navigate to the directory where you want the note
2. `Shift+⌘P` to open the command pallette
3. Type `New Note` until it appears in the list. Press `Enter/Return` to select it.
4. Enter a title for the note
5. Manually enter the template contents you want

#### Foam template note creation (Keyboard)

1. `Shift+⌘P` to open the command pallette
2. Type `Create New Note From Template` until it appears in the list. Press `Enter/Return` to select it.
3. Use the arrow keys (or type the template name) to select the template. Press `Enter/Return` to select it.
4. Modify the filepath to match the desired directory + filename. Press `Enter/Return` to select it.

All of these steps are far too cumbersome. And only the last one allows the use of templates.

### Templating of daily notes

Currently `Open Daily Note` opens an otherwise empty note, with a title defined by the `foam.openDailyNote.titleFormat` setting.
Daily notes should be able to be fully templated as well.

### Templating of filepaths

As discussed in ["Template the filepath in `openDailyNote`"](https://github.com/foambubble/foam/issues/523), it would be useful to be able to specify the default filepaths of templates. For example, many people include timestamps in their filepaths.

## Goal / Philosophy

In a sentence: **Creating a new note should be a single button press and should use templates.**

## Proposal

1. Add a new `Foam: Create New Note` that is the streamlined counterpart to the more flexible `Foam: Create New Note From Template`
2. Use templates everywhere
3. Add metadata into the actual templates themselves in order to template the filepaths themselves.

### Summary

This can be done through a series of changes to the way that templates are implemented:

1. Add a `${title}` and `${titleSlug}` template variables
2. Add a `Foam: Create New Note` command and hotkey
3. Change missing wikilinks to use the default template
4. Add a metadata section to templates
5. Add a replacement for `dateFormat`
6. Add support for daily note templates
7. Eliminate all `foam.openDailyNote` settings

I've broken it out into these steps to show that the overall proposal can be implemented piecemeal in independent PRs that build on one another.

### Add a `${title}` and `${titleSlug}` template variables

When you use `Markdown Notes: New Note`, and give it a title, the title is formatted as a filename and also used as the title in the resulting note.

**Example:**

Given the title `Living in a dream world` to `Markdown Notes: New Note`, the filename is `living-in-a-dream-world.md` and the file contents are:

```markdown
# Living in a dream world
```

When creating a note from a template in Foam, you should be able to use a `${title}` variable. If the template uses the `${title}` variable, the user will be prompted for a title when they create a note from a template.

Example:

Given this `.foam/templates/my_template.md` template that uses the `${title}` variable:

```markdown
# ${title}
```

When a user asks for a new note using this template (eg. `Foam: Create New Note From Template`), VSCode will first ask the user for a title then provide it to the template, producing:

```markdown
# Living in a dream world
```

There will also be a `${titleSlug}` variable made available, which will be the "slugified" version of the title (eg. `living-in-a-dream-world`). This will be useful in later steps where we want to template the filepath of a template.

### Add a `Foam: Create New Note` command and hotkey

Instead of using `Markdown Notes: New Note`, Foam itself will have a `Create New Note` command that creates notes using templates.

This would open use the template found at `.foam/templates/new-note.md` to create the new note.

`Foam: Create New Note` will offer the fastest workflow for creating a note when you don't need customization, while `Foam: Create New Note From Template` will remain to serve a fully customizable (but slower) workflow.

#### Case 1: `.foam/templates/new-note.md` doesn't exist

If `.foam/templates/new-note.md` doesn't exist, it behaves the same as `Markdown Notes: New Note`:

* it would ask for a title and create the note in the current directory. It would open a note with the note containing the title.

**Note:** this would use an implicit default template, making use of the `${title}` variable.

#### Case 2: `.foam/templates/new-note.md` exists

If `.foam/templates/new-note.md` exists:

* it asks for the note title and creates the note in the current directory

**Progress:** At this point, we have a faster way to create new notes from templates.

### Change missing wikilinks to use the default template

Clicking on a dangling/missing wikilink should be equivalent to calling `Foam: Create New Note` with the contents of the link as the title.
That way, creating a note by navigating to a missing note uses the default template.

### Add a metadata section to templates

* The `Foam: New Note` command creates a new note in the current directory. This is a sensible default that makes it quick, but lacks flexibility.
* The `Foam: Create New Note From Template` asks the user to confirm/customize the filepath. This is more flexible but slower since there are more steps involved.

Both commands use templates. It would be nice if we could template the filepaths as well as the template contents (See ["Template the filepath in `openDailyNote`"](https://github.com/foambubble/foam/issues/523) for a more in-depth discussion the benefits of filepath templating).

In order to template the filepath, there needs to be a place where metadata like this can be specified.
I think this metadata should be stored alongside the templates themselves. That way, it can make use of all the same template variable available to the templates themselves.

Conceptually, adding metadata to the templates is similar to Markdown frontmatter, though the choice of exact syntax for adding this metadata will have to be done with care since the templates can contain arbitrary contents including frontmatter.

#### Example

A workable syntax is still to be determined.
While this syntax probably doesn't work as a solution, for this example I will demonstrate the concept using a second frontmatter block:

```markdown
<!-- The below front-matter block is for foam-specific template settings -->
<!-- It is removed when the user creates a new note using this template -->
---
<!-- The default filepath to use when using this template -->
<!-- Relative paths are relative to the workspace, absolute paths are absolute -->
<!-- Note that you can include VSCode snippet variables to template the path -->
filepath: `journal/${CURRENT_YEAR}-${CURRENT_MONTH}-${CURRENT_DATE}_${titleSlug}.md`
---

<!-- The actual contents of the template begin after the `---` thematic break immediately below this line-->
---
---
created: ${CURRENT_YEAR}-${CURRENT_MONTH}-${CURRENT_DATE}T${CURRENT_HOUR}:${CURRENT_MINUTE}:${CURRENT_SECOND}
tags: []
---

# ${title}
```

In this example, using this template improves the UX:

In `Foam: Create New Note` workflow, having `filepath` metadata within `.foam/templates/new-note.md` allows for control over the filepath without having to introduce any more UX steps to create a new note. It's still just a hotkey away and a title.

As we'll see, when it comes to allowing daily notes to be templated, we don't even need to use `${title}` in our template, in which case we don't we don't even need to prompt for a title.

In the `Create New Note From Template` workflow, during the step where we allow the user to customize the filepath, it will already templated according to the `filepath` in the template's metadata. This means that the user has to make fewer changes to the path, especially in cases where they want to include things like datetimes in the filenames. This makes it faster (eg. don't have to remember what day it is, and don't have to type it) and less error-prone (eg. when they accidentally type the wrong date).

### Add a replacement for `dateFormat`

`foam.openDailyNote.filenameFormat` uses `dateFormat()` to put the current timestamp into the daily notes filename. This is much more flexible than what is available in VSCode Snippet variables. Before daily notes are switched over to use templates, we will have to come up with another mechanism/syntax to allow for calls to `dateFormat()` within template files.

This would be especially useful in the migration of users to the new daily notes templates. For example, if `.foam/templates/daily-note.md` is unset, then we could generate an implicit template for use by `Foam: Open Daily Note`. Very roughly something like:

```markdown
<!-- The below front-matter block is for foam-specific template settings -->
<!-- It is removed when the user creates a new note using this template -->
---
<!-- The default filepath to use when using this template -->
<!-- Relative paths are relative to the workspace, absolute paths are absolute -->
<!-- Note that you can include VSCode snippet variables to template the path -->
filepath: `${foam.openDailyNote.directory}/${foam.openDailyNote.filenameFormat}.${foam.openDailyNote.fileExtension}`
---

<!-- The actual contents of the template begin after the `---` thematic break immediately below this line-->
---
# ${foam.openDailyNote.titleFormat}
```

### Add support for daily note templates

With the above features implemented, making daily notes use templates is simple.

We define a `.foam/templates/daily-note.md` filepath that the `Foam: Open Daily Note` command will always use to find its daily note template.
If `.foam/templates/daily-note.md` does not exist, it falls back to a default, implicitly defined daily notes template (which follows the default behaviour of the current `foam.openDailyNote` settings).

Both `Foam: Open Daily Note` and `Foam: Create New Note` can share all of the implementation code, with the only differences being the hotkeys used and the template filepath used.

Example daily note template (again using the example syntax of the foam-specific frontmatter block):

```markdown
<!-- The below front-matter block is for foam-specific template settings -->
<!-- It is removed when the user creates a new note using this template -->
---
<!-- The default filepath to use when using this template -->
<!-- Relative paths are relative to the workspace, absolute paths are absolute -->
<!-- Note that you can include VSCode snippet variables to template the path -->
filepath: `journal/${CURRENT_YEAR}-${CURRENT_MONTH}-${CURRENT_DATE}.md`
---

<!-- The actual contents of the template begin after the `---` thematic break immediately below this line-->
---
# ${CURRENT_YEAR}-${CURRENT_MONTH}-${CURRENT_DATE}
```

Since there is no use of the `${title}` variable, opening the daily note behaves exactly as it does today and automatically opens the note with no further user interaction.

### Eliminate all `foam.openDailyNote` settings

Now that all of the functionality of the `foam.openDailyNote` settings have been obviated, these settings can be removed:

* `foam.openDailyNote.directory`, `foam.openDailyNote.filenameFormat`, and `foam.openDailyNote.fileExtension` can be specified in the `filepath` metadata of the daily note template.
* `foam.openDailyNote.titleFormat` has been replaced by the ability to fully template the daily note, including the title.

## Summary: resulting behaviour

### `Foam: Create New Note`

A new command optimized for speedy creation of new notes. This will become the default way to create new notes. In its fastest form, it simply opens the new note with no further user interaction.

### `Foam: Open Daily Note`

Simplified since it no longer has its custom settings, and re-uses all the same implementation code as `Foam: Create New Note`.
Templates can now be used with daily notes.

### Navigating to missing wikilinks

Now creates the new notes using the default template. Re-uses all the same implementation code as `Foam: Create New Note`
Now uses the contents of the wikilink as the `${title}` parameter for the template.

### `Foam: Create Note From Template`

Almost the exact same as it is today. However, with `${title}` and `filepath` templating, users will have less changes to make in the filepath confirmation step.
It's the slower but more powerful version of `Foam: Create New Note`, allowing you to pick any template, as well as customize the filepath.

## Extensions

In addition to the ideas of this proposal, there are ways we could imagine extending it. These are all "out of scope" for this design, but thinking about them could be useful to guide our thinking about this design.

### More variables in templates

`${title}` is necessary in this case to replace the functionality of `Markdown Notes: New Note`.
However, one could imagine that this pattern of "Ask the user for a value for missing variable values" could be useful in other situations too.
Perhaps users could even define their own (namespaced) template variables, and Foam would ask them for values to use for each when creating a note using a template that used those variables.

### `defaultFilepath`

By using `defaultFilepath` instead of `filepath` in the metadata section, you could have more control over the note creation without having to fall back to the full `Create New Note From Template` workflow.

* `filepath` will not ask the user for the file path, simply use the value provided (as described above)
* `defaultFilepath` will ask the user for the file path, pre-populating the file path using `defaultFilepath`

The first allows "one-click" note creation, the second more customization.
This might not be necessary, or this might not be the right way to solve the problem. We'll see.

### Arbitrary hotkey -> template mappings?

`Foam: Open Daily Note` and `Foam: Create New Note` only differ by their hotkey and their default template setting.
Is there a reason/opportunity to abstract this further and allow for users to define custom `hotkey -> template` mappings?
