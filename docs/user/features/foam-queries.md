# Foam Queries

A Foam Query selects notes by tag, link, property, or other criteria. Queries answer questions like "show my research notes", "list notes linked to this topic", or "count notes in this folder".

Queries are surfaced in two places:

- **Inline in a note** — write a `foam-query` block to render results in the Markdown preview.
- **Saved on disk** — drop a YAML file in `.foam/queries/` to reuse the same query across contexts. VS Code surfaces saved queries as [[smart-folders]] in the side bar.

The query syntax is the same in both. The rest of this page documents that syntax.

For static note embeds, see [[embeds]].

## Saved Queries

Save a query as a YAML file at `.foam/queries/<id>.yaml` to reuse it. The filename (without extension) is the id; rename the file to rename the query.

A saved query inlines the query fields at the root of the YAML, plus two optional wrapper fields:

```yaml
name: Work in Progress           # optional; defaults to a humanized form of the filename
description: Notes I am editing  # optional
filter:
  and:
    - tag: "#wip"
    - not:
        tag: "#archive"
sort: title ASC
limit: 50
```

The minimal valid file is one line: `filter: "#wip"`.

A saved query file is interchangeable with a `foam-query` block — copy the body of one straight into the other.

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
- `links_to`: notes that link to the given note identifier. Use `"$current"` to refer to the note containing the query
- `links_from`: notes that are linked from the given note identifier. Use `"$current"` to refer to the note containing the query
- `jexl`: a [Jexl](https://github.com/TomFrost/Jexl) expression evaluated against each note, e.g. `"resource.tags|length > 2"`. The expression has access to `resource` (with fields `title`, `path`, `type`, `tags`, `properties`, `backlinks`, `outlinks`) and the built-in transforms `length`, `lower`, `upper`. Note: Jexl uses `==` (not `===`) and `|length` (not `.length`). The previous `expression` field is deprecated and no longer evaluated.
- `and`, `or`, `not`: combine filters logically
- _`expression`: REMOVED. A JavaScript expression that used to be evaluated against each note. Replaced by jexl for security reasons; legacy queries match nothing_
- Use `"$current"` in `links_to` or `links_from` to query relative to the note containing the query block:

````markdown
```foam-query
filter:
  links_to: "$current"
```
````

## Displayed Fields

You can select these fields:

- `title`
- `path`
- `type`
- `tags`
- `aliases`
- `sections`
- `blocks`
- `properties` (use `properties.<name>` to pick one)
- `backlink-count`
- `outlink-count`
- `body` — the full note text (frontmatter removed, H1 title kept), rendered as markdown
- `content` — same as `body` but without the H1 title; useful when the title is already shown in another column
- `section[Label]` — the content of the named section (heading removed), rendered as markdown

Example table:

````markdown
```foam-query
filter: "#research"
select: [title, tags, backlink-count]
sort: backlink-count DESC
format: table
```
````

### Including note content in results

To show the full text of each matching note, select `body` or `content`:

````markdown
```foam-query
filter:
  jexl: "resource.properties.status == 'to_ask'"
select: [title, body]
```
````

To show just a named section, use `section[Label]`. Labels may contain spaces:

````markdown
```foam-query
filter:
  jexl: "resource.properties.status == 'to_ask'"
format: table
select:
  - title
  - section[Question]
  - properties.status
```
````

When you write `select:` as a block sequence (each field on its own line, prefixed with `-`), you can use `section[My Label]` directly. If you use the inline form `select: [...]`, YAML treats `[` and `]` as collection delimiters, so quote the value: `select: [title, 'section[My Label]']`.

Section labels are matched **case-sensitively** — `section[Question]` will not match a heading written `## question`.

> `body`, `content`, and `section[...]` aren't supported in VS Code Web — you'll see an inline warning in their place. Everything else works.

### Customising table column headers

By default the table header shows the field expression. For `section[Decision]` and `properties.Status` the wrapper is stripped automatically so you see `Decision` and `Status`. To set an explicit label, use the object form for that entry:

````markdown
```foam-query
filter: "#decisions"
format: table
select:
  - title
  - field: section[Decision]
    label: Chosen Decision
  - field: properties.Status
    label: Question status
```
````

Plain strings and `{ field, label }` objects can be mixed in the same `select`.

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

Use `foam-query-js` when YAML is not enough. JavaScript queries only run in a [trusted workspace](https://code.visualstudio.com/docs/editor/workspace-trust). In a trusted workspace, a `foam-query-js` block runs with the same permissions as the rest of VS Code — it can read and write files, make network requests, and run any code your editor can. Treat blocks the same way you'd treat any script you'd download and run: only enable a trusted workspace for notes you author or trust.

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

`foam.current` is the URI of the note containing the query. Use it to write queries that are relative to the current note:

````markdown
```foam-query-js
// Show all notes that link to this note
render(foam.pages({ links_to: foam.current }).sortBy('title'));
```
````

````markdown
```foam-query-js
// Show all notes that this note links to
render(foam.pages({ links_from: foam.current }).sortBy('title'));
```
````

`foam.current` is `null` if no document is active in the editor.

Available builder methods:

- `where(fn)`: keep only notes where `fn(note)` returns true, e.g. `.where(n => n.tags.includes('draft'))`
- `sortBy(field, direction?)`: sort by field, direction is `'asc'` (default) or `'desc'`
- `limit(n)`: return at most `n` results
- `offset(n)`: skip the first `n` results
- `select(fields)`: project to the given fields. Each entry can be a plain string (e.g. `'title'`) or an object `{ field, label }` to customise the table column header, e.g. `.select(['title', { field: 'properties.Status', label: 'State' }])`
- `format(fmt)`: set the output format (`'list'`, `'table'`, or `'count'`)
- `toArray()`: return results as a plain array for use in custom logic

Call `render(...)` to show output in the preview. You can pass a query builder or a plain string.

> Using `.where` together with `body`/`content`/`section[...]` is slow on large workspaces — narrow your results with a regular `foam-query` filter first when you can.

## Trust And Limitations

- `foam-query-js` requires a [trusted workspace](https://code.visualstudio.com/docs/editor/workspace-trust). In a trusted workspace it runs with full editor permissions — no internal sandbox. If you don't trust the source of your notes, keep the workspace untrusted.
- `jexl` filters run in any workspace — Jexl is sandboxed by language design (no host globals, no file system, no network).
- Queries render in Markdown preview, not directly in the editor.
- Query results link back to the matching notes.

[embeds]: embeds.md 'Note Embeds'
[smart-folders]: smart-folders.md 'Smart Folders'
