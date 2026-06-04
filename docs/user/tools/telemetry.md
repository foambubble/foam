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
- Your OS family (`darwin`, `linux`, `win32`) and Node version
- An anonymous installation ID — a random UUID generated locally on first run. The same ID is reused across CLI and MCP so we can tell they're the same install; it has no link to your account, machine, or hardware.

At a high level:

- **VS Code extension** sends a small set of session events: that Foam loaded, which commands you ran, your enum/boolean settings, and bucketed workspace size (e.g. "201-500 notes"). No file names, paths, or note titles.
- **CLI** sends one event per invocation: which command ran, how long it took (bucketed: `<10ms`, `<50ms`, `<500ms`, `<5s`, `<30s`, `30s+`), and bucketed workspace size.
- **MCP** sends one event per tool call the LLM makes: which tool was called, how long it took, and whether it succeeded. Tool arguments and returned content are never sent.

The full event list is at the [bottom of this page](#full-event-list).

## How to opt out

### VS Code extension

Foam respects VS Code's global telemetry setting. Open Settings, search for `telemetry.telemetryLevel`, and set it to `off`.

### CLI

On the first run, the CLI prints a notice describing what is collected and asks you to confirm. The default is **enabled** — pressing Enter accepts it. Your choice is saved in `~/.config/foam/config.json` and not asked again.

If the CLI is run non-interactively (CI, piped input, etc.), it cannot prompt — it defaults to enabled and records that fact so you know.

You can change your choice at any time:

- Set `FOAM_TELEMETRY=0` in your environment, or
- Edit `~/.config/foam/config.json` and set `"telemetry.enabled": false`

### MCP

MCP runs as a child of either the CLI or the VS Code extension, and inherits its opt-out:

- When run via `foam mcp` (the common case, e.g. configured in Claude Desktop / Cursor): the CLI's opt-out applies.
- When run via the VS Code extension: VS Code's `telemetry.telemetryLevel` applies.

## Where the data goes

All events are sent to a single Azure Application Insights resource owned by the Foam project. Connection strings used to send data are not secrets — they only permit writing events, never reading them. Aggregated, anonymized usage data may be shared with the Foam community to inform roadmap discussions. Raw event data is not shared.

## Full event list

### Common properties (every event)

| Property           | Example                    | Description                                                      |
| ------------------ | -------------------------- | ---------------------------------------------------------------- |
| `foam.component`   | `vscode`, `cli`, `mcp`     | Which Foam component emitted the event                           |
| `foam.version`     | `0.26.0`                   | Version of that component                                        |
| `foam.coreVersion` | `0.4.1`                    | Version of `@foam/core`                                          |
| `node.version`     | `22.5.0`                   | Node runtime version (omitted in the VS Code webview)            |
| `os.platform`      | `darwin`, `linux`, `win32` | Operating system family                                          |
| `installationId`   | (random UUID)              | Anonymous installation ID. Omitted on the `cli.first-run` event. |

### Bucket scales

- **Duration**: `<10ms`, `<50ms`, `<500ms`, `<5s`, `<30s`, `30s+`
- **Workspace size (note count)**: `0`, `1-10`, `11-50`, `51-200`, `201-500`, `500-1000`, `1000-2000`, `2000-5000`, `5000-10000`, `10000+`

### VS Code events (`vscode.*`)

| Event                         | When it fires                               | Properties                                                                                                                                                                                 |
| ----------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `vscode.session-started`      | Once per extension activation               | none                                                                                                                                                                                       |
| `vscode.session-with-command` | First Foam command in a session             | none                                                                                                                                                                                       |
| `vscode.session-with-note`    | First markdown file opened in a session     | none                                                                                                                                                                                       |
| `vscode.command`              | Every Foam command invocation               | `command` (identifier only — no arguments)                                                                                                                                                 |
| `vscode.feature`              | First time a feature activates in a session | `feature`; enum/boolean values only                                                                                                                                                        |
| `vscode.config-snapshot`      | Once per session                            | selected enum/boolean settings — e.g. `graph.onStartup`, `completion.linkFormat`, `links.hover.enable`, `graph.viewsConfigured` (count, not names). Free-text settings are never included. |
| `vscode.workspace-stats`      | Once per session                            | `noteCount` (bucket), `hasTemplates`, `hasDailyNoteTemplate`                                                                                                                               |
| `vscode.error`                | An unhandled error in a Foam feature        | `context` (feature name), `errorType` (error class name only — no message, no stack)                                                                                                       |

### CLI events (`cli.*`)

| Event | When it fires | Properties |
|---|---|---|
| `cli.command-invoked` | Once per CLI invocation, after the command completes | `command`, `durationBucket`, `exitCode`. Some commands attach extra properties — e.g. `note create` and `daily --create` attach `template-type` (one of `default`, `daily-note`, `custom`) and `template-format` (`md` / `js`). Both are omitted when no template was applied (e.g. a `note create` that fell back to the minimal `# title` body). |
| `cli.error` | A CLI command exits with an unhandled error | `command`, `context`, `errorType` |
| `cli.first-run` | Exactly once per installation, after the consent choice is recorded. Carries no `installationId`, no `os.platform`, no `node.version`. | `consent`: `granted` / `declined` (from the prompt), or `default_on` (no prompt was possible — non-TTY / CI / piped) |

### MCP events (`mcp.*`)

| Event | When it fires | Properties |
|---|---|---|
| `mcp.session-started` | Once per server start | `client` (e.g. `claude-desktop`, `cursor`, omitted if not exposed); `workspaceSize`; `mode` (`read` or `read-write` — whether the server was started with `--read-only`) |
| `mcp.session-with-tool` | First tool call in a session | none |
| `mcp.tool-invoked` | Every tool call (sent unsampled) | `tool` (name only — arguments never recorded), `durationBucket`, `outcome` (`success` / `error`) |
| `mcp.error` | An unhandled error during MCP dispatch | `context`, `tool`, `errorType` |
