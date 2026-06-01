# Telemetry

Foam collects anonymous usage data to help understand how Foam is used across its different components (VS Code extension, CLI, MCP server) and to prioritize improvements.

This page describes exactly what is sent, what is never sent, and how to opt out.

## What is never collected

This applies to every Foam component, without exception:

- Note content, titles, file names, or tag names
- Wikilink targets, search queries, or any text the user typed
- Folder paths or any user-defined string
- Free-text configuration values
- Command arguments, CLI flag values, or MCP tool arguments
- Stack traces or error messages (only the error class name is sent)
- Anything that could identify you personally

## Common properties

Every event from every component carries the same base properties:

| Property           | Example                    | Description                                           |
| ------------------ | -------------------------- | ----------------------------------------------------- |
| `foam.component`   | `vscode`, `cli`, `mcp`     | Which Foam component emitted the event                |
| `foam.version`     | `0.26.0`                   | Version of that component                             |
| `foam.coreVersion` | `0.4.1`                    | Version of `@foam/core` it was built against          |
| `node.version`     | `22.5.0`                   | Node runtime version (omitted in the VS Code webview) |
| `os.platform`      | `darwin`, `linux`, `win32` | Operating system family                               |

An anonymous installation identifier is also attached: a random UUID generated on first run and stored in `~/.config/foam/installation-id`. The same file is shared across all Foam components (VS Code extension, CLI, MCP), so the same installation appears consistently across components on the same machine.

The UUID has no link to your operating system, user account, or machine hardware — it is generated locally and never leaves the file unless telemetry is enabled.

## Duration buckets

Durations are always bucketed before sending — exact timings are not. The buckets are:

`<10ms`, `<50ms`, `<500ms`, `<5s`, `<30s`, `30s+`

## Workspace size buckets

Note counts are bucketed:

`0`, `1-10`, `11-50`, `51-200`, `201-500`, `500-1000`, `1000-2000`, `2000-5000`, `5000-10000`, `10000+`

---

## VS Code extension events (`vscode.*`)

The VS Code extension respects VS Code's global `telemetry.telemetryLevel` setting — if you disable telemetry in VS Code, Foam sends nothing.

### `vscode.session-started`

Fired once per extension activation, before Foam finishes loading. The canonical "active session" metric.

Properties: none beyond the common ones.

### `vscode.session-with-command`

Fired once per session, the first time the user invokes any Foam command. Distinguishes "Foam loaded" from "Foam was actually used".

Properties: none.

### `vscode.session-with-note`

Fired once per session, the first time a markdown file is opened. A proxy for "this workspace is being used for notes, not just code".

Properties: none.

### `vscode.command`

Fired every time a Foam command is invoked.

| Property  | Example                       | Notes                                   |
| --------- | ----------------------------- | --------------------------------------- |
| `command` | `foam-vscode.open-daily-note` | Command identifier only — no arguments. |

### `vscode.feature`

Fired the first time a feature is activated within a session.

| Property                       | Example                     |
| ------------------------------ | --------------------------- |
| `feature`                      | `graph-view`, `daily-notes` |
| (additional, feature-specific) | enum/boolean values only    |

### `vscode.config-snapshot`

Fired once per session. Records the values of selected configuration settings — only enum/boolean settings whose set of possible values is known and small. Free-text settings (folder paths, templates, etc.) are never included.

| Property                        | Example    | Notes                                                                    |
| ------------------------------- | ---------- | ------------------------------------------------------------------------ |
| `graph.onStartup`               | `false`    |                                                                          |
| `graph.navigateToPreview`       | `false`    |                                                                          |
| `graph.viewsConfigured`         | `3`        | Count of custom graph view configurations defined in `foam.graph.views`. |
| `links.hover.enable`            | `true`     |                                                                          |
| `links.sync.enable`             | `false`    |                                                                          |
| `completion.linkFormat`         | `wikilink` |                                                                          |
| `completion.useAlias`           | `false`    |                                                                          |
| `files.defaultNoteExtension`    | `.md`      |                                                                          |
| `ai.enabled`                    | `false`    |                                                                          |
| `edit.linkReferenceDefinitions` | `off`      |                                                                          |

### `vscode.workspace-stats`

Fired once per session. Bucketed workspace shape.

| Property               | Example   |
| ---------------------- | --------- |
| `noteCount`            | `201-500` |
| `hasTemplates`         | `true`    |
| `hasDailyNoteTemplate` | `true`    |

### `vscode.error`

Fired when an unhandled error occurs in a Foam feature.

| Property    | Example                     | Notes                                             |
| ----------- | --------------------------- | ------------------------------------------------- |
| `context`   | `graph-view`, `daily-notes` | The feature where the error occurred.             |
| `errorType` | `TypeError`, `SyntaxError`  | The error class name only — no message, no stack. |

---

## CLI events (`cli.*`)

The CLI is a one-shot process — each command invocation is independent, so there is no "session".

On the first run, the CLI prints a notice describing what telemetry is collected and how to opt out, then asks for confirmation. The default choice is **enabled** — pressing Enter accepts it. The choice is recorded in `~/.config/foam/config.json` and not asked again. You can change it later at any time with `FOAM_TELEMETRY=0` or `foam config set telemetry.enabled false`.

We only emit telemetry for a curated set of commands and only for properties we know are interesting (read vs. read-write nature, workspace trust mode, etc.). Command arguments and flag values are never recorded.

### `cli.command-invoked`

Fired once per CLI invocation, after the command completes.

| Property         | Example                       | Notes                                       |
| ---------------- | ----------------------------- | ------------------------------------------- |
| `command`        | `graph`, `janitor`, `migrate` | The top-level command.                      |
| `mode`           | `read`, `read-write`          | Whether the command modifies the workspace. |
| `trust`          | `trusted`, `untrusted`        | Workspace trust state if applicable.        |
| `durationBucket` | `<500ms`                      | See duration buckets above.                 |
| `exitCode`       | `0`, `1`                      | Process exit code.                          |
| `workspaceSize`  | `201-500`                     | Note count bucket.                          |

### `cli.error`

Fired when a CLI command exits with an unhandled error.

| Property    | Example           |
| ----------- | ----------------- |
| `command`   | `janitor`         |
| `context`   | `link-resolution` |
| `errorType` | `TypeError`       |

### `cli.first-run`

Fired exactly once, after the user has seen the first-run telemetry notice and the consent choice has been recorded. Fires for both outcomes so that opt-out rate can be measured — this is the same approach the Azure CLI and GitHub CLI take.

This event is special: it carries **no installation identifier** and **no `os.platform` or Node version**. Only the common `foam.*` version properties and the consent value are sent. After this event fires, if `consent: declined`, no further events are ever sent from this installation.

| Property  | Value                 |
| --------- | --------------------- |
| `consent` | `granted`, `declined` |

---

## MCP events (`mcp.*`)

The MCP server is a long-lived process spawned by an LLM client (e.g. Claude Desktop, Cursor). It has its own session model.

Because MCP servers run non-interactively, the first-run flow is different from the CLI: there is no prompt. On first start, the server prints a notice to stderr (LLM clients typically surface this in their logs or UI) describing what is collected and how to opt out, and telemetry starts **enabled**. The state is recorded in `~/.config/foam/config.json` so the notice is not shown again. You can opt out at any time with `FOAM_TELEMETRY=0` in the MCP server's environment (configured in your LLM client) or by editing `~/.config/foam/config.json`.

### `mcp.session-started`

Fired once per server start.

| Property        | Example                    | Notes                                                                          |
| --------------- | -------------------------- | ------------------------------------------------------------------------------ |
| `client`        | `claude-desktop`, `cursor` | The connecting LLM client, if the MCP handshake exposes it. Omitted otherwise. |
| `workspaceSize` | `51-200`                   | Note count bucket.                                                             |

### `mcp.session-with-tool`

Fired once per session, the first time the LLM calls any Foam tool. Distinguishes "server spun up" from "server actually used".

Properties: none.

### `mcp.tool-invoked`

Fired every time the LLM calls a Foam MCP tool. Sent unsampled.

| Property           | Example                           | Notes                                                            |
| ------------------ | --------------------------------- | ---------------------------------------------------------------- |
| `tool`             | `search-notes`, `get-backlinks`   | The tool name. Tool arguments are never recorded.                |
| `durationBucket`   | `<50ms`                           | See duration buckets above.                                      |
| `resultSizeBucket` | `empty`, `1-10`, `11-100`, `100+` | Coarse size of the result set. Result content is never recorded. |
| `outcome`          | `success`, `error`                | Did the tool call succeed?                                       |

### `mcp.error`

Fired when an MCP request results in an unhandled error.

| Property    | Example         |
| ----------- | --------------- |
| `context`   | `tool-dispatch` |
| `tool`      | `search-notes`  |
| `errorType` | `TypeError`     |

### `mcp.first-run`

Same shape and semantics as `cli.first-run`. Fires exactly once, after the consent choice has been recorded, for both outcomes. Carries no installation identifier, no `os.platform`, and no Node version.

| Property  | Value                 |
| --------- | --------------------- |
| `consent` | `granted`, `declined` |

---

## How to opt out

### VS Code extension

Foam respects VS Code's global telemetry setting.

1. Open Settings (`Cmd+,` on macOS, `Ctrl+,` on Windows/Linux)
2. Search for `telemetry.telemetryLevel`
3. Set it to `off` (or `error` for crash reports only, `crash` for crash data only)

### CLI

Either of:

- Set the environment variable `FOAM_TELEMETRY=0`
- Run `foam config set telemetry.enabled false`

### MCP

Either of:

- Set the environment variable `FOAM_TELEMETRY=0` in the MCP server's environment (configured in your LLM client)
- Edit `~/.config/foam/config.json` and set `"telemetry.enabled": false`
