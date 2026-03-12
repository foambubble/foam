# Foam Queries

Foam Queries let you show dynamic lists, tables, and counts of notes inside the Markdown preview.

Use them when you want a note to answer questions such as "show my research notes", "list notes linked to this topic", or "count notes in this folder".

For static note embeds, see [[embeds]].

## Basic Query

Use a `foam-query` code block:

````markdown
```foam-query
filter: "#research"
sort: title ASC
limit: 10
```
````

This renders a list of matching notes in the preview. Query results update as your workspace changes.

If you omit `filter`, Foam searches all notes:

````markdown
```foam-query
format: count
```
````

## Query Options

- `filter`: choose which notes to include
- `select`: choose which fields to display. Default: `title` and `path`
- `sort`: sort results, for example `title ASC` or `backlink-count DESC`. Include the sort field in `select`, otherwise it will not be available after projection.
- `limit`: show only the first `n` matches
- `offset`: skip the first `n` matches
- `format`: render as `list`, `table`, or `count`

When you select more than one field, Foam renders a table by default.

## Filters

### Simple Filters

Use these shortcuts for common cases:

- `"#tag"`: notes with that tag
- `"[[note-id]]"`: notes linked to or from that note (use the same identifier as in wikilinks, e.g. the filename without extension)
- `"/regex/"`: notes whose path matches the regular expression
- `"*"`: all notes

Example:

````markdown
```foam-query
filter: "[[project-alpha]]"
```
````

### Structured Filters

Use YAML when you need more control:

````markdown
```foam-query
filter:
  and:
    - tag: "#research"
    - not:
        path: "^/archive/"
select: [title, tags, backlink-count]
sort: title ASC
```
````

Supported filter keys:

- `tag`: notes that have this tag (e.g. `tag: "#research"`)
- `type`: notes of this type (e.g. `type: "daily-note"`)
- `path`: notes whose path matches this regex (e.g. `path: "^/projects/"`)
- `title`: notes whose title matches this regex
- `links_to`: notes that link to the given note identifier
- `links_from`: notes that are linked from the given note identifier
- `expression`: a JavaScript expression evaluated against each note, e.g. `"resource.tags.length > 2"`. Only evaluated in trusted workspaces.
- `and`, `or`, `not`: combine filters logically

## Displayed Fields

You can select these fields:

- `title`
- `path`
- `type`
- `tags`
- `aliases`
- `sections`
- `blocks`
- `properties`
- `backlink-count`
- `outlink-count`

Example table:

````markdown
```foam-query
filter: "#research"
select: [title, tags, backlink-count]
sort: backlink-count DESC
format: table
```
````

## Count Queries

Use `count` when you only need the number of matches:

````markdown
```foam-query
filter:
  path: "^/projects/"
format: count
```
````

## JavaScript Queries

Use `foam-query-js` when YAML is not enough. JavaScript queries only run in a trusted workspace.

````markdown
```foam-query-js
const recentResearch = foam.pages('#research')
  .sortBy('title')
  .limit(5)
  .format('list');

render('Recent research notes:');
render(recentResearch);
```
````

`foam.pages(filter?)` returns a query builder. Omit the filter to include all notes.

Available builder methods:

- `where(fn)`: keep only notes where `fn(note)` returns true, e.g. `.where(n => n.tags.includes('draft'))`
- `sortBy(field, direction?)`: sort by field, direction is `'asc'` (default) or `'desc'`
- `limit(n)`: return at most `n` results
- `offset(n)`: skip the first `n` results
- `select(fields)`: project to the given fields
- `format(fmt)`: set the output format (`'list'`, `'table'`, or `'count'`)
- `toArray()`: return results as a plain array for use in custom logic

Call `render(...)` to show output in the preview. You can pass a query builder or a plain string.

## Trust And Limitations

- `foam-query-js` requires a trusted workspace
- `expression` filters are only evaluated in trusted workspaces
- Queries render in Markdown preview, not directly in the editor
- Query results link back to the matching notes

[embeds]: embeds.md "Note Embeds"
