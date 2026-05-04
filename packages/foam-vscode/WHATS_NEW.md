# Foam CLI

## Foam CLI

Foam now ships a command-line interface — interact with your workspace from the terminal without opening VS Code.

```bash
# Run without installing
npx foam-cli <command> [options]

# Or install globally
npm install -g foam-cli
foam <command> [options]
```

[Learn more about the command-line interface](https://docs.foamnotes.com/tools/cli/)

## Graph revamp

The graph view has been significantly improved:

- Redesigned for better UX
- **Node groups** let you visually cluster notes in a flexible way
- Added **Graph Views**

[Learn more about the graph view](https://docs.foamnotes.com/features/graph-view/)

## Block references

In case you missed it, some time ago we added full support for referencing and embedding blocks in the editor and the preview.

[Learn more about blocks](https://docs.foamnotes.com/features/block-anchors/)

## Foam Queries

Embed dynamic, auto-updating note lists directly in the Markdown preview using `foam-query` code blocks:

````markdown
```foam-query
filter: "#project"
sort: title ASC
select: [title, path]
```
````

Results render inline as a linked list of matching notes. The query updates automatically as your notes change.

[Learn more about Foam Queries](https://docs.foamnotes.com/features/foam-queries/)

## Footnotes

Foam now supports footnotes with proper rendering and navigation in editor and the Markdown preview.

[Learn more about footnotes](https://docs.foamnotes.com/features/footnotes/)

## Notes Explorer filtering

The Notes Explorer panel now supports filtering, making it easier to navigate large vaults.
