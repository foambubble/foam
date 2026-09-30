# Multi-root workspaces

A VS Code [multi-root workspace](https://code.visualstudio.com/docs/editor/multi-root-workspaces) has several folders side by side. A common setup is a notes folder you add to each of your projects, so both your global notes and the project's notes are at hand:

```
my-project.code-workspace
├── my-project/   ← first folder
└── notes/        ← your notes, added to every workspace
```

Foam indexes every folder, so links and the graph work across them. What needs care is where new notes go: by default, Foam creates them in the first folder.

## Settings

Put Foam settings in the `.code-workspace` file or in your user settings. In a multi-root workspace, VS Code ignores them in a folder's own `.vscode/settings.json`.

## Templates

Foam looks for [[templates]] in the templates folder (`.foam/templates` by default) of every folder in the workspace:

- **Foam: Create New Note From Template** lists the templates of all folders.
- For the special `new-note` and `daily-note` templates, Foam checks each folder in the order they're listed and uses the first one it finds. The templates in your notes folder are used in every workspace whose project has none of its own.
- New templates are created in the first folder, both by **Foam: Create New Template** and when Foam offers to create a daily note template. Move the file into your notes folder to have it in every workspace.

## Create notes in your notes folder

Start the template's `filepath` with `/` and the name of the folder the note should go in. Save this as `notes/.foam/templates/global-note.md`:

```markdown
---
foam_template:
  name: Global Note
  filepath: '/notes/inbox/$FOAM_SLUG.md'
---

# $FOAM_TITLE
```

In any workspace you add `notes` to, **Foam: Create New Note From Template** offers "Global Note" and creates the note in `notes/inbox/`, wherever `notes` is in the folder list.

[[daily-notes]] work the same way, with `notes/.foam/templates/daily-note.md`:

```markdown
---
foam_template:
  filepath: '/notes/journal/$FOAM_DATE_YEAR-$FOAM_DATE_MONTH-$FOAM_DATE_DATE.md'
---

# $FOAM_DATE_YEAR-$FOAM_DATE_MONTH-$FOAM_DATE_DATE
```

A few things to know:

- Use the folder's name on disk, not a different name you gave it in the `.code-workspace` file.
- You can also write the full path on disk, like `/Users/me/notes/inbox/$FOAM_SLUG.md`. Foam uses it as is, but the template then only works where the folder is at that exact path.
- If no folder has that name, the path starts from the first folder: `/journal/today.md` goes in `my-project/journal/`.
- This is about where new notes go. In a link, a leading slash doesn't name a folder: `[[/notes/idea]]` looks for `notes/idea.md` inside each folder, so link to `[[idea]]` instead.

With the default settings, notes created without a `filepath`, such as with **Foam: Create New Note** when there's no `new-note` template, go in the first folder: your project.

## Related

- [[templates]] — the full template reference
- [[daily-notes]] — daily note templates
- [[notes-in-a-subfolder]] — notes inside a bigger project, in a single folder

[templates]: ../features/templates.md 'Note Templates'
[daily-notes]: ../features/daily-notes.md 'Daily Notes'
[notes-in-a-subfolder]: notes-in-a-subfolder.md 'Keep your notes in a subfolder'
