# Telemetry

Foam collects anonymous usage data to help understand how the extension is used and prioritize improvements.

## What is collected

Foam sends the following information once per session:

**Commands used** — which Foam commands you run (e.g. open daily note, show graph). No command arguments are recorded.

**Configuration** — which settings you have enabled or changed, using only predefined values (e.g. `"wikilink"` or `"markdown"` for link format). Free-text settings such as folder paths are never sent.

**Workspace stats** — a rough size of your workspace (bucketed note count, e.g. `"51-200"`), and whether features like templates or AI are set up. No file names, note titles, or content are ever sent.

## What is never collected

- Note content, titles, or file names
- Tag names or wikilink targets
- Folder paths or any user-defined text
- Any information that could identify you personally

## How to opt out

Foam respects VS Code's global telemetry setting. To disable telemetry for all extensions including Foam:

1. Open Settings (`Cmd+,` on macOS, `Ctrl+,` on Windows/Linux)
2. Search for `telemetry.telemetryLevel`
3. Set it to `off`

You can also set it to `error` to allow only crash reports, or `crash` to allow only crash data.
