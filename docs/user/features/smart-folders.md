# Smart Folders

Smart Folders are how Foam surfaces your saved queries in the VS Code side bar. Each Smart Folder is a query stored at `.foam/queries/<id>.yaml` — see [[foam-queries]] for the query syntax.

Use them to navigate large workspaces without locking yourself into rigid tag hierarchies. For example: a "Work in Progress" folder showing notes tagged `#wip` but not `#archive`.

## Create a Smart Folder

Open the **Smart Folders** panel in the Explorer and click **Create Smart Folder**, or run the command **Foam: Create Smart Folder**.

You will be asked for:

1. A name (e.g. "Work in Progress")
2. Tags to include (multi-select — press Esc to skip and edit the YAML manually)

Foam creates a YAML file at `.foam/queries/<name>.yaml` and opens it for editing.

## Edit a Smart Folder

Click the pencil icon next to a Smart Folder in the panel, or open the YAML file directly. Changes are picked up automatically.

For the full syntax — structured filters, sorting, links, Jexl expressions — see [[foam-queries]].

## Delete a Smart Folder

Click the trash icon next to a Smart Folder in the panel and confirm. The YAML file is removed.

## View options

In the panel title bar:

- **Group By Folder / Flat list** — group matching notes by their workspace path or show as a flat list
- **Refresh** — re-run all queries on demand

[foam-queries]: foam-queries.md 'Foam Queries'
