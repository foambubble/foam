# foam daily

Show or create the daily note for a date.

```
foam daily [options]
```

Without `--create`, the command only reports whether the note exists. With `--create`, it writes the note if it doesn't exist yet, using your daily note template if one is configured.

## Options

| Option                | Description                                                                |
| --------------------- | -------------------------------------------------------------------------- |
| `--date <YYYY-MM-DD>` | Date to target (default: today)                                            |
| `--create`            | Create the note if it doesn't exist                                        |
| `--path-only`         | Print only the resolved file path (useful for scripting)                   |
| `--workspace <dir>`   | Workspace root (default: `FOAM_WORKSPACE` env var, then current directory) |
| `--format <fmt>`      | Output format: `text` (default) or `json`                                  |

## Examples

Show today's daily note status:

```bash
foam daily
# journal/2024-01-15.md  [exists]
```

Create today's daily note:

```bash
foam daily --create
```

Get the path to a specific date's note (for scripting):

```bash
foam daily --date 2024-01-10 --path-only
# /home/user/notes/journal/2024-01-10.md
```

Open today's note in your editor:

```bash
$EDITOR $(foam daily --create --path-only)
```

## Daily note path

If your daily note template (`.foam/templates/daily-note.md` or `.foam/templates/daily-note.js`) sets a file path, the note goes there. Otherwise the deprecated `foam.openDailyNote.*` settings in `.vscode/settings.json` decide, and without them notes go to `journal/YYYY-MM-DD.md` — the same place VS Code puts them. The template, when there is one, always provides the content.

See [[templates]] for how to configure daily note templates.

[templates]: ../../features/templates.md 'Note Templates'
