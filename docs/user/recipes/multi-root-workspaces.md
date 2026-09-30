# Multi-root workspaces

A VS Code [multi-root workspace](https://code.visualstudio.com/docs/editor/multi-root-workspaces) has several folders side by side. A common setup is a knowledge base you add to each of your projects, so both your own notes and the project's notes are at hand:

```
my-project.code-workspace
├── my-project/       ← first folder
└── knowledge-base/   ← your knowledge base, added to every workspace
```

Foam indexes every folder, so links and the graph work across them. What needs care is where new notes go: by default, Foam creates them in the first folder.

## Settings

Put Foam settings in the `.code-workspace` file or in your user settings. In a multi-root workspace, VS Code ignores them in a folder's own `.vscode/settings.json`.

## Templates

Foam looks for [[templates]] in the templates folder (`.foam/templates` by default) of every folder in the workspace:

- **Foam: Create New Note From Template** lists the templates of all folders. When two folders have a template with the same name, it shows which folder each one is in.
- For the special `new-note` and `daily-note` templates, Foam checks each folder in the order they're listed and uses the first one it finds.
- New templates are created in the first folder.

## Create notes in a specific folder

A template's `filepath` can name the folder a note goes in: start it with `/` and the folder's name. For example, if you want all new notes to go in `knowledge-base/inbox/`, your `new-note` template, `knowledge-base/.foam/templates/new-note.md`, would look like this:

```markdown
---
foam_template:
  filepath: '/knowledge-base/inbox/$FOAM_SLUG.md'
---

# $FOAM_TITLE
```

**Foam: Create New Note**, and Ctrl+clicking a `[[placeholder]]`, then create the note in `knowledge-base/inbox/`, in every workspace you add `knowledge-base` to, as long as the project has no `new-note` template of its own. To choose for each note instead, give the template another name, such as `global-note.md`, and pick it with **Foam: Create New Note From Template**.

[[daily-notes]] work the same way, with `knowledge-base/.foam/templates/daily-note.md`:

```markdown
---
foam_template:
  filepath: '/knowledge-base/journal/$FOAM_DATE_YEAR-$FOAM_DATE_MONTH-$FOAM_DATE_DATE.md'
---

# $FOAM_DATE_YEAR-$FOAM_DATE_MONTH-$FOAM_DATE_DATE
```

A few things to know:

- Use the folder's name on disk, with the same capitalization, not a different name you gave it in the `.code-workspace` file.
- If no folder has that name, the path starts from the first folder: `/journal/today.md` goes in `my-project/journal/`.
- The same template works when you open the knowledge base on its own: `/knowledge-base/inbox/` is then its own `inbox/` folder.

With the default settings, notes created without a `filepath`, such as with **Foam: Create New Note** when there's no `new-note` template, go in the first folder.

## Related

- [[templates]] — the full template reference
- [[daily-notes]] — daily note templates
- [[notes-in-a-subfolder]] — notes inside a bigger project, in a single folder

[templates]: ../features/templates.md 'Note Templates'
[daily-notes]: ../features/daily-notes.md 'Daily Notes'
[notes-in-a-subfolder]: notes-in-a-subfolder.md 'Keep your notes in a subfolder'
