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
| `--trust`             | Run a JavaScript daily note template (`daily-note.js`)                     |
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

If your daily note template (`.foam/templates/daily-note.md` or `.foam/templates/daily-note.js`) sets a file path, the note goes there. Otherwise notes go to `journal/YYYY-MM-DD.md` — the same place VS Code puts them. The template, when there is one, always provides the content.

If `.vscode/settings.json` still has `foam.openDailyNote.*` settings that would have put the note somewhere else, `foam daily` stops with an error showing the template to save, or the file path to add to yours, to keep your notes where they were. Removing the settings works too. A template can't put notes outside the workspace, so if the settings did, move those notes into the workspace first.

The path must stay inside the workspace, even through symlinks: otherwise `foam daily --create` stops with an error telling you to check the template's file path.

See [[templates]] for how to configure daily note templates.

## JavaScript templates

A JavaScript template runs code on your computer, so when your workspace has `.foam/templates/daily-note.js`, `foam daily` stops with an error unless you add `--trust`:

```bash
foam daily --create --trust
```

Only add `--trust` if you wrote the template yourself, or trust whoever did.

[templates]: ../../features/templates.md 'Note Templates'
