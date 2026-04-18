# Graph revamp, Queries, Footnotes, and more

## Graph revamp

The graph view has been significantly improved:

- Redesigned for better UX
- **Node groups** let you visually cluster notes in a flexible way
- Added **Graph Views**

[Learn more about the graph view](https://github.com/foambubble/foam/blob/main/docs/user/features/graph-view.md)

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

[Learn more about Foam Queries](https://github.com/foambubble/foam/blob/main/docs/user/features/foam-queries.md)

## Footnotes

Foam now supports footnotes with proper rendering and navigation in editor and the Markdown preview.

[Learn more about footnotes](https://github.com/foambubble/foam/blob/main/docs/user/features/footnotes.md)

## Notes Explorer filtering

The Notes Explorer panel now supports filtering, making it easier to navigate large vaults.
