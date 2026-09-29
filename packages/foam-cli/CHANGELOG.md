# Change Log

## 0.46.3

### Patch Changes

- Embeds and `foam-query` content cells show the right part of the note (#1716,
  #1718):

  - Whole-note embeds no longer render the note's frontmatter as a horizontal
    rule followed by a heading
  - `content` embeds keep the whole note body: previously they kept only the
    first section and always dropped its first line
  - The title removed by `content` embeds and the `foam-query` `content` field is
    the note's first H1, wherever it sits — also below a comment or badge, and
    including the underline of a setext (`===`) heading. A note whose first
    heading is an H2 keeps it
  - `section[Label]` cells no longer leave a setext heading's underline behind
  - An indented code block right after the frontmatter keeps its indentation

  In `@foam/core`, `Section` gains a `headingRange` covering just the heading
  lines, and `stripFrontMatterAndTitle` is exported.

- Exported notes no longer repeat their title or leak frontmatter (#1719). Both
  the HTML report and `foam export` to Starlight now drop the note's first H1
  when it is the title, including a setext H1 or one below a comment, and keep it
  when a different frontmatter `title` replaces it. The Starlight homepage no
  longer gets two frontmatter blocks, and notes with CRLF line endings or a `...`
  frontmatter closer are handled.

  In `@foam/core`, `ExportedNote` gains `body`: the exported markdown without the
  frontmatter and title heading.

- b108125: Correctness and lifecycle fixes from the core model review:

  - Files whose names differ only by case no longer overwrite each other in the
    workspace index (silent data loss on case-sensitive filesystems)
  - The incremental graph now re-resolves links that a newly added note wins by
    identifier or directory-index priority, staying equivalent to a full rebuild
  - Rename edits can no longer corrupt files: duplicate definition edits are
    deduplicated, partially overlapping edits are rejected, and a single
    unparsable link skips that link instead of aborting the rename
  - Tag ranges are computed correctly for frontmatter tags that are substrings
    of other tags and for hashtags on continuation lines of multi-line
    paragraphs; quoted "tags" frontmatter keys are recognized
  - Published static-site graph JSON no longer includes raw note frontmatter,
    only allowlisted presentation keys (color, type)
  - Uppercase attachment extensions (photo.PNG) are classified like their
    lowercase counterparts; rapid successive changes to one file can no longer
    leave stale content in the workspace; disposal no longer leaks FoamTags,
    resource providers, or graph-webview registrations; one failing feature no
    longer aborts the whole extension activation

- 6a645fa: Fixed notes disappearing from the workspace index when their folder is moved or
  renamed in the Explorer ([#1696](https://github.com/foambubble/foam/issues/1696)).
  The notes were dropped from the Notes Explorer, graph, backlinks, `foam-query`
  and wikilink resolution, under both the old and the new path, and only a window
  reload brought them back. Because the entries were gone, moving the same folder
  a second time also silently stopped updating any links pointing into it.

  A directory rename now migrates the index itself instead of relying on file
  watcher events that a directory-granularity rename may never produce: the
  affected notes are re-indexed under their new paths as part of the rename, on
  every platform. Index migration also no longer depends on the
  `foam.links.sync.enable` setting.

  Include/exclude matching now evaluates the globs directly rather than looking
  paths up in a snapshot of the workspace file listing, which could go stale and
  never recover. Matching is case-insensitive and covers dot-directories, mirroring
  how `workspace.findFiles` behaves today, and the VS Code extension and the CLI
  now share one matcher implementation.

- a4f170e: New `FOAM_PREVIOUS_DAILY_NOTE` template variable: in a daily note template it
  expands to the identifier of the most recent daily note that exists before the
  one being created, skipping gaps like weekends, so
  `[[$FOAM_PREVIOUS_DAILY_NOTE]]` links to it and
  `${FOAM_PREVIOUS_DAILY_NOTE:nothing yet}` supplies a fallback for the first
  daily note. It only works when the daily note path spells out year, month and
  day in numbers (#1706).
- 6ac7ded: `isWithinPath` now compares Windows drive paths case-insensitively, matching
  what `FoamWorkspace` already did for its own root matching. The two helpers
  answer the same question — "is this path inside that one?" — but only the
  workspace one allowed for a drive letter whose case differs between VS Code
  and Node, which is a case the codebase already knew it could not trust.

  The exact comparison reached four places: the check that a new note is inside
  the workspace, `getRootUriFor` (which picks the root for `.foam/trash` and for
  workspace-relative paths), the MCP server's path serialisation, and the export
  asset filter. On Windows a drive-case mismatch could make each of them decide
  a path was outside the workspace when it was not.

- 05b8a96: Note creation is now defined once in `@foam/core` and shared by the VS Code
  commands (create note, daily notes), the CLI and the MCP server. The check
  that a new note stays inside the workspace — including on every retry path
  proposed while handling an existing file, and after a template has set its
  own `filepath` — now lives in a single place.

  Behavior changes that come with it:

  - The VS Code create-note command resolves template content once. Passing
    `FOAM_SELECTED_TEXT` as a variable no longer appends the selected text
    twice.
  - Foam variables in the content returned by a JavaScript template are
    resolved in the CLI and MCP server as well, not only in VS Code.
  - `foam note create --dir <dir>` (and the MCP `create_resource` `dir`
    argument) is honored when the `new-note.md` template sets no `filepath`;
    it used to be ignored in that case.
  - A daily-note directory configured as an absolute path outside the
    workspace is used as such when a `daily-note.md` template sets no
    `filepath`, matching the behavior without a template. It used to be
    re-rooted inside the workspace.

- 466ad05: Fixes to note creation and folder renames, found by re-enabling the foam-vscode
  integration suite:

  - `create-note` no longer fails with `path.startsWith is not a function` when
    given a URI, and the workspace no longer throws `reference.split is not a
    function` when looked up by one. Both accept a URI-like object but narrowed on
    `instanceof URI`, which does not hold for a URI that crosses into the extension
    bundle's inlined copy of `@foam/core`. The other `string | URI` narrowings in
    `URI` itself now discriminate on the string too
  - Renaming a folder keeps its notes in the index without a gap: they are re-keyed
    under the new path as the rename completes, instead of being removed and
    re-read asynchronously, which briefly left them indexed under neither path
  - Renaming the same folder twice in a row now updates the wikilinks both times.
    The files rewritten by the first rename are re-indexed, and the work is
    registered as a rename participant so it completes before the rename lands
    rather than racing whatever comes next
  - A note inside a renamed folder that linked to a sibling by a path-qualified
    wikilink kept its old link in the index: the rename re-keyed a copy of the
    note taken before its links were rewritten, so the backlink disappeared until
    the file was next read. The file on disk was always correct
  - Deleting a path that is already gone no longer brings down the extension host
    with an unhandled `EntryNotFound` rejection, and neither does renaming one

- 1042c53: Foam query `path` and `folder` fields are now workspace-relative, as documented,
  instead of exposing the absolute filesystem path. Previously a workspace at
  `C:\Docs` (or `/home/me/notes`) rendered `/C:/Docs/test/file.md` instead of
  `/test/file.md`. The `path:` filter, the `"/regex/"` shorthand, and `jexl`'s
  `resource.path` now match against the same workspace-relative path, so anchored
  patterns like `path: "^/projects/"` behave identically on every OS. (#1698)

## 0.46.2

### Patch Changes

- bb903f9: Make the `@foam/core` barrel bundler-safe for non-Node runtimes (browsers,
  React Native):

  - The exports that execute user-supplied JavaScript via Node's `vm` —
    `TemplateLoader`, `resolveDailyNote`, `noteCreate`, `renderJsQuery` — moved
    out of the main barrel to the new **`@foam/core/scripting`** subpath
    (published as `foam-core/scripting`). Migration: change the import
    specifier; the APIs are unchanged.
  - Platform detection rewritten as a pure, tested `detectPlatform()`
    (exported, along with `isReactNative`). Fixes Node ≥ 21 being misclassified
    as web (Node now ships a global `navigator`). The previously exported but
    unused `isIOS`, `locale`, `Platform`, `Language`, `translationsConfigFile`,
    `isElectronSandboxed` and `globals` are removed.
  - `stripFrontMatter` no longer uses gray-matter, which requires Node's
    `Buffer` at call time. Behavior change: an unclosed opening `---` delimiter
    is no longer treated as frontmatter (gray-matter would swallow the whole
    document).
  - New portability gate in the build: the public barrel must type-check with
    no Node and no DOM types (`tsconfig.portability.json`).

  `foam-vscode` and `@foam/cli` are bumped because they bundle `@foam/core`.

- Moved `EventLoopMonitor` and `formatMemoryUsage` from foam-vscode into
  `@foam/core` (exported from the barrel). They were host-agnostic by
  construction — `process` feature-detected, `unref` optional-chained — and
  belong next to `LoadProfiler` so the CLI can produce the same load report as
  the extension. No behavior change. `foam-vscode` and `@foam/cli` are bumped
  because they bundle `@foam/core`.
- 7b50c54: Added a workspace load report to help diagnose slow startups (#1689). The Foam
  output log now breaks the load time down into file reads, markdown parsing and
  unaccounted time, along with parser cache hit rate, extension host event loop
  lag, and the slowest notes to parse.
- be76f9e: Fixed Foam variables being duplicated when used as defaults for mirrored
  snippet tabstops (#1215).

## 0.46.1

### Patch Changes

- Picks up the latest `@foam/core` improvements: incremental graph updates and coalesced workspace re-scans (better performance on large workspaces), and the fix that stops autogenerated link reference blocks from re-emitting user-authored external reference definitions ([#1686](https://github.com/foambubble/foam/pull/1686)).

## 0.46.0

### Minor Changes

- Added support for saved queries (CLI and MCP) and Smart Folders (VS Code) — the new Smart Folders panel lets you view a subset of your notes via saved filters, using the same query syntax as `foam-query` blocks ([#462](https://github.com/foambubble/foam/issues/462))

## 0.45.0

### Minor Changes

- `foam mcp` now defaults to read-only. Pass `--allow-writes` to expose the write tools (`create_resource`, `update_resource`, `delete_resource`, `move_resource`, `add_tags`, `remove_tags`, `rename_tag`) to the AI agent. The previous `--read-only` flag has been removed.

  Documentation for the `foam mcp` subcommand has also been added — see [the user docs](https://docs.foam.md/tools/cli/mcp).

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
