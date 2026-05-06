# Change Log

## 0.41.0

### Minor Changes

- Internal: Added a `commands/` module to `@foam/core` exposing high-level workspace operations (`listNotes`, `listTags`, `listOrphans`, `listDeadends`, `listPlaceholders`, `linksData`, `outlineData`, `searchWorkspace`, `noteShowData`, `noteCreate`, `noteMove`, `noteDelete`, `renameNote`, `renameTag`, `renameSection`, `renameBlock`, `resolveNote`, frontmatter helpers). The CLI and VS Code extension now consume these shared functions instead of maintaining parallel implementations

- Added `matchMode: 'substring' | 'subsequence'` option to `searchWorkspace` and exposed `isSubsequence` as a string utility, so consumers can choose VS Code symbol-search-style fuzzy matching

- `listOrphans` and `listDeadends` accept an `OrphansOptions` parameter with `excludeTypes` (default `['attachment', 'image']`) and `ignoreOutgoingExcludedTypes` (treats notes whose only outgoing links are attachments/images as orphans)

### Patch Changes

- Internal: Consolidated release scripts and updated developer documentation
