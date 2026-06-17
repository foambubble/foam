# Change Log

## 0.44.0

### Minor Changes

- Added support for saved queries (CLI and MCP) and Smart Folders (VS Code) — the new Smart Folders panel lets you view a subset of your notes via saved filters, using the same query syntax as `foam-query` blocks ([#462](https://github.com/foambubble/foam/issues/462))

### Patch Changes

- JavaScript code in templates and queries now requires a trusted context (e.g. a trusted workspace) — the previous sandbox did not actually isolate execution and has been removed

## 0.43.1

### Patch Changes

- `foam-query` HTML output now escapes single quotes in addition to the other HTML metacharacters, preventing attribute-value injection from note content.

## 0.43.0

### Minor Changes

- Foam queries now support custom column labels in table results, letting you rename headers in `foam-query` output ([#1658](https://github.com/foambubble/foam/issues/1658)).

### Patch Changes

- Performance: speed up workspace file scans on large workspaces, addressing extension-host stalls reported in [#1624](https://github.com/foambubble/foam/issues/1624).

  - `fromVsCodeUri` is ~5× faster — it now copies fields directly from the VS Code `Uri` instead of round-tripping through `toString()` + `URI.parse`. Called once per file during every workspace scan and tree refresh.
  - The matcher's file listing skips per-file deduplication when a folder has a single include pattern (the common case), avoiding repeated `Uri.fsPath` computation. In the multi-pattern fallback, dedup keys off `Uri.toString()` (memoized by VS Code) instead of `fsPath`.

## 0.42.0

### Minor Changes

- `parseFilter` and `executeQuery` now return parse-time warnings alongside their primary result, so callers can surface filter problems. Markdown preview now renders these warnings above query results.

- `foam-query` blocks can now select note content as a field: `body` (full text with the H1 title kept), `content` (without the title), and `section[Label]` (the content of a named section, heading stripped).

### Patch Changes

- Replace the `eval()`-backed `expression` query filter with a sandboxed `jexl` filter. The `expression` field is deprecated and no longer evaluated — queries using it now match nothing and log a warning.

- Limit the number of notes processed concurrently during workspace bootstrap to avoid exhausting file descriptors on large workspaces (possible fix for [#1167](https://github.com/foambubble/foam/issues/1167)).

## 0.41.2

### Patch Changes

- Renamed the "workspace janitor" feature to "workspace lint", including commands and documentation

## 0.41.1

### Patch Changes

- Internal: Improved frontmatter handling and added `traverseGraph` helper for graph traversal

- Ensure path resolution stays within the workspace root to prevent path traversal in MCP and CLI tools

- Internal: Added a POSIX-safe path utility module so `@foam/core` no longer depends on Node's `path` module, keeping it browser- and mobile-safe

- Screen user-supplied regex patterns in query filters with `safe-regex2` to reject catastrophically backtracking patterns before evaluation

- Internal: Exposed test utilities via `@foam/core/test` so downstream packages share a single set of fixtures and helpers

- Internal: Extracted MCP server logic into a standalone `@foam/mcp` package

- Workspace is no longer trusted by default in MCP and CLI contexts, preventing untrusted query expressions and JS templates from executing

## 0.41.0

### Minor Changes

- Internal: Added a `commands/` module to `@foam/core` exposing high-level workspace operations (`listNotes`, `listTags`, `listOrphans`, `listDeadends`, `listPlaceholders`, `linksData`, `outlineData`, `searchWorkspace`, `noteShowData`, `noteCreate`, `noteMove`, `noteDelete`, `renameNote`, `renameTag`, `renameSection`, `renameBlock`, `resolveNote`, frontmatter helpers). The CLI and VS Code extension now consume these shared functions instead of maintaining parallel implementations

- Added `matchMode: 'substring' | 'subsequence'` option to `searchWorkspace` and exposed `isSubsequence` as a string utility, so consumers can choose VS Code symbol-search-style fuzzy matching

- `listOrphans` and `listDeadends` accept an `OrphansOptions` parameter with `excludeTypes` (default `['attachment', 'image']`) and `ignoreOutgoingExcludedTypes` (treats notes whose only outgoing links are attachments/images as orphans)

### Patch Changes

- Internal: Consolidated release scripts and updated developer documentation
