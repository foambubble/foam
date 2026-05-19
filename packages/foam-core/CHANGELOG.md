# Change Log

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
