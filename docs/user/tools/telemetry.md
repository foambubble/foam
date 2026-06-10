# Telemetry

Foam collects anonymous usage data to help understand how Foam is used and to prioritize improvements. This page describes what is sent, what is never sent, and how to opt out.

## What is never collected

This applies to every Foam component:

- Note content, titles, file names, or tag names
- Wikilink targets, search queries, or any text you typed
- Folder paths or any user-defined string
- Free-text configuration values
- Command arguments, CLI flag values, or MCP tool arguments
- Stack traces or error messages (only the error class name is sent)
- Anything that could identify you personally

## What is collected

Every event includes:

- Which component sent it (`vscode`, `cli`, `mcp`)
- The version of that component and of `@foam/core`
- Your OS family — CLI/MCP send `os.platform` (`darwin`, `linux`, `win32`) and Node version; VS Code's library reports OS and version via its own `common.*` properties (see [Common properties](#common-properties))
- An anonymous identifier — CLI and MCP share an installation UUID generated locally on first run. VS Code uses the pseudonymous machine ID provided by Microsoft's `@vscode/extension-telemetry` library (`common.vscodemachineid`); we cannot disable that and we never link it to the CLI/MCP ID.

At a high level:

- **VS Code extension** sends a small set of session events: that Foam loaded, which commands you ran, your enum/boolean settings, and bucketed workspace size (e.g. "201-500 notes"). No file names, paths, or note titles.
- **CLI** sends one event per invocation: which command ran, how long it took (bucketed: `0-10ms`, `11-50ms`, `51-300ms`, `301-1000ms`, `1-5s`, `5-30s`, `30s+`), and bucketed workspace size.
- **MCP** sends one event per tool call the LLM makes: which tool was called, how long it took, and whether it succeeded. Tool arguments and returned content are never sent.

The full event list is at the [bottom of this page](#full-event-list).

## How to opt out

### VS Code extension

Foam respects VS Code's global telemetry setting. Open Settings, search for `telemetry.telemetryLevel`, and set it to `off`.

### CLI

On the first run, the CLI prints a notice describing what is collected and asks you to confirm. The default is **enabled** — pressing Enter accepts it. Your choice is saved in `~/.config/foam/config.json` and not asked again.

If the CLI is run non-interactively (CI, piped input, MCP launched by Claude Desktop / Cursor, etc.), it cannot prompt — it prints a disclosure to stderr and defaults to enabled **for that session only**. No choice is persisted, so the next interactive CLI run will still ask. To make the choice durable in a non-interactive context, set `FOAM_TELEMETRY=0` or `FOAM_TELEMETRY=1` in the environment, or edit `~/.config/foam/config.json` directly.

You can change your choice at any time:

- Set `FOAM_TELEMETRY=0` in your environment, or
- Edit `~/.config/foam/config.json` and set `"telemetry.enabled": false`

### MCP

MCP runs as a child of the CLI (`foam mcp ...`, typically configured in Claude Desktop / Cursor / `mcp.json`). It inherits the CLI's opt-out — set `FOAM_TELEMETRY=0` in the MCP server's environment, or edit `~/.config/foam/config.json`.

## Where the data goes

All events are sent to a single Azure Application Insights resource owned by the Foam project. Connection strings used to send data are not secrets — they only permit writing events, never reading them. Aggregated, anonymized usage data may be shared with the Foam community to inform roadmap discussions. Raw event data is not shared.

## Full event list

### Common properties

The properties below are attached to every event.

| Property           | Components            | Example                    | Description                                                                            |
| ------------------ | --------------------- | -------------------------- | -------------------------------------------------------------------------------------- |
| `foam.component`   | CLI, MCP, VS Code     | `cli`, `mcp`, `vscode`     | Which Foam component emitted the event                                                 |
| `foam.version`     | CLI, MCP, VS Code     | `0.26.0`                   | Version of that component                                                              |
| `foam.coreVersion` | CLI, MCP, VS Code     | `0.4.1`                    | Version of `@foam/core`                                                                |
| `node.version`     | CLI, MCP              | `22.5.0`                   | Node runtime version (CLI/MCP only — VS Code reports it via `common.platformversion`)  |
| `os.platform`      | CLI, MCP              | `darwin`, `linux`, `win32` | Operating system family (CLI/MCP only — VS Code reports it via `common.os`)            |
| `installationId`   | CLI, MCP              | (random UUID)              | Anonymous installation ID shared across CLI and MCP. Sent on the App Insights envelope as the `ai.user.id` tag, not as an event property. Omitted on the `cli.first-run` event. |

VS Code events additionally carry the `common.*` properties added by Microsoft's `@vscode/extension-telemetry` library — these are not controlled by Foam:

| Property                  | Description                                                                                                       |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `common.extname`          | Extension name (`foam.foam-vscode`)                                                                               |
| `common.extversion`       | Extension version                                                                                                 |
| `common.vscodemachineid`  | Pseudonymous machine identifier generated by VS Code. Distinct from Foam's `installationId`; we cannot disable it. |
| `common.vscodesessionid`  | Per-session identifier generated by VS Code                                                                       |
| `common.vscodeversion`    | VS Code version                                                                                                   |
| `common.vscodecommithash` | VS Code commit hash                                                                                               |
| `common.os`               | OS running VS Code                                                                                                |
| `common.platformversion`  | OS/platform version                                                                                               |
| `common.product`          | VS Code host (`desktop`, `github.dev`, `codespaces`, …)                                                           |
| `common.uikind`           | `web` or `desktop`                                                                                                |
| `common.remotename`       | Type of remote connection if any (`ssh`, `wsl`, `dev-container`, or `other`)                                      |
| `common.nodeArch`         | Node architecture (e.g. `arm64`, `x64`, or `web`)                                                                  |

You can disable VS Code's telemetry — and therefore everything Foam sends from VS Code — via the global **`telemetry.telemetryLevel`** setting (`off`). The CLI and MCP opt-out is separate and is described above.

### Bucket scales

- **Duration**: `<10ms`, `<50ms`, `<500ms`, `<5s`, `<30s`, `30s+`
- **Workspace size (note count)**: `0`, `1-10`, `11-50`, `51-200`, `201-500`, `501-1000`, `1001-2000`, `2001-5000`, `5001-10000`, `10000+`

### VS Code events (`vscode.*`)

| Event                         | When it fires                               | Properties                                                                                                                                                                                 |
| ----------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `vscode.session-started`      | Once per extension activation               | none                                                                                                                                                                                       |
| `vscode.session-with-command` | First Foam command in a session             | none                                                                                                                                                                                       |
| `vscode.session-with-note`    | First markdown file opened in a session     | none                                                                                                                                                                                       |
| `vscode.command`              | Every Foam command invocation               | `command` (identifier only — no arguments)                                                                                                                                                 |
| `vscode.config-snapshot`      | Once per session                            | selected enum/boolean settings — e.g. `graph.onStartup`, `completion.linkFormat`, `links.hover.enable`, `graph.viewsConfigured` (count, not names). Free-text settings are never included. |
| `vscode.workspace-stats`      | Once per session                            | `noteCount` and `attachmentCount` (both bucketed), `hasTemplates`, `hasDailyNoteTemplate`                                                                                                  |
| `vscode.error`                | An unhandled error in a Foam feature        | `context` (feature name), `errorType` (error class name only — no message, no stack)                                                                                                       |

### CLI events (`cli.*`)

| Event | When it fires | Properties |
|---|---|---|
| `cli.command-invoked` | Once per CLI invocation that runs a known command, after it completes. Skipped for `--help`, `--version`, `foam config`, and unknown commands (typos) — those never emit telemetry. | `command`, `durationBucket`, `exitCode`. When the command threw an error caught by the dispatcher, also `errorType` (error class name only — no message, no stack) and `errorContext` (where it was caught — `dispatch`). Some commands attach extra properties — e.g. `note create` and `daily --create` attach `template-type` (one of `default`, `daily-note`, `custom`) and `template-format` (`md` / `js`). Both are omitted when no template was applied (e.g. a `note create` that fell back to the minimal `# title` body). `daily` additionally attaches `mode`: `create` when a new daily note was written this invocation, `open` for read-only lookups and for `--create` against a note that already existed (nothing was written). |
| `cli.first-run` | At most twice per installation: once for the strongest consent outcome we've recorded so far. Anonymous — carries no `installationId`, no `os.platform`, no `node.version`. An install that runs headlessly first (e.g. MCP) fires once with `default_on`; if the same install later answers an interactive CLI prompt, a second event fires with `granted` / `declined` (the "upgrade"). Subsequent runs of either kind are deduped via state.json. | `consent`: `granted` / `declined` (from an interactive prompt), or `default_on` (non-interactive first encounter) |

### MCP events (`mcp.*`)

| Event | When it fires | Properties |
|---|---|---|
| `mcp.session-started` | Once per server start | `client` (e.g. `claude-desktop`, `cursor`, omitted if not exposed); `noteCount` and `attachmentCount` (both bucketed); `mode` (`read` or `read-write` — `read-write` is set when the CLI is started with `--allow-writes`; the default is `read`) |
| `mcp.session-with-tool` | First tool call in a session | none |
| `mcp.tool-invoked` | Every tool call (sent unsampled) | `tool` (name only — arguments never recorded), `durationBucket`, `outcome` (`success` / `error`) |
| `mcp.error` | An unhandled error during MCP dispatch. Rare in practice: tool handlers are wrapped to convert throws into structured `isError: true` results, which surface as `outcome: 'error'` on `mcp.tool-invoked`. `mcp.error` is the safety net for anything that escapes that wrapping. | `context`, `tool`, `errorType` |
