# Change Log

## 0.45.0

### Minor Changes

- `foam mcp` now defaults to read-only. Pass `--allow-writes` to expose the write tools (`create_resource`, `update_resource`, `delete_resource`, `move_resource`, `add_tags`, `remove_tags`, `rename_tag`) to the AI agent. The previous `--read-only` flag has been removed.

  Documentation for the `foam mcp` subcommand has also been added — see [the user docs](https://foambubble.github.io/foam/user/tools/cli/mcp).

## 0.44.0

### Minor Changes

- New `foam graph` command exports the workspace link graph as JSON to stdout, in a d3-force–compatible shape.

- Added anonymous usage telemetry. See the telemetry documentation for the full event schema and how to opt out ([#1664](https://github.com/foambubble/foam/issues/1664)).

## 0.43.0

### Minor Changes

- `foam query` now picks up the latest `@foam/core` changes:

  - New `foam-query` source fields: `body`, `content`, and `section[Label]` ([#1654](https://github.com/foambubble/foam/issues/1654)).
  - The `expression` filter has been replaced with a sandboxed `jexl` filter; queries using `expression` will no longer match and will log a warning — migrate by renaming to `jexl` (e.g. `resource.tags.length > 2` → `resource.tags|length > 2`, `===` → `==`).
  - Parse-time filter warnings (rejected regex, unresolved link target, Jexl compile error, deprecated `expression` field) are now surfaced alongside query results instead of being silently logged.
  - Workspace bootstrap limits the number of notes processed concurrently to avoid exhausting file descriptors on large workspaces (possible fix for [#1167](https://github.com/foambubble/foam/issues/1167)).

## 0.42.1

### Patch Changes

- Fix published site rendering a page multiple times when it had multiple connections to the same target

## 0.42.0

### Minor Changes

- Expose `foam-mcp` as a subcommand of the CLI, allowing AI agents to interact with a Foam workspace via the Model Context Protocol

### Patch Changes

- Internal: Added end-to-end tests for the MCP server via `mcp-tools-inspector` and improved CLI/MCP test coverage

- Workspace is no longer trusted by default in MCP and CLI contexts, preventing untrusted query expressions and JS templates from executing

- @foam/core@0.41.1

## 0.41.1

### Patch Changes

- Internal: Consolidated release scripts and updated developer documentation

- Internal: Added a `commands/` module to `@foam/core` exposing high-level workspace operations (`listNotes`, `listTags`, `listOrphans`, `listDeadends`, `listPlaceholders`, `linksData`, `outlineData`, `searchWorkspace`, `noteShowData`, `noteCreate`, `noteMove`, `noteDelete`, `renameNote`, `renameTag`, `renameSection`, `renameBlock`, `resolveNote`, frontmatter helpers). The CLI and VS Code extension now consume these shared functions instead of maintaining parallel implementations

## 0.41.0

### Minor Changes

- Add colored output across all CLI commands, with auto-detection of TTY and respect for `NO_COLOR`

- Add `update` command and a passive non-blocking version check that notifies when a newer version of `foam-cli` is available

### Patch Changes

- Internal: Add `foam` script to run the built CLI locally

## 0.40.2

### Patch Changes

- Add unified config system shared between the extension and the CLI (#1638)

## 0.40.1

### Patch Changes

- Set up npm publishing for `@foam/cli` (released as `foam-cli`) and update installation instructions

## 0.40.0

### Minor Changes

- Reintroduce `foam-cli` as a standalone CLI built on top of `@foam/core`, providing commands for working with a Foam workspace from the terminal (#1636)
