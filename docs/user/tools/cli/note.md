# foam note

Show, create, move, or delete notes.

```
foam note <subcommand> [options]
```

## Subcommands

### show

Print metadata for a note.

```bash
foam note show (<identifier> | --path <path>) [--links] [--content]
```

| Option          | Description                                       |
| --------------- | ------------------------------------------------- |
| `--links`       | Include outgoing and incoming links in the output |
| `--content`     | Print the full note content instead of metadata   |
| `--path <path>` | Target by exact file path                         |

Example:

```bash
foam note show my-note
# ID:       my-note
# Title:    My Note
# Path:     notes/my-note.md
# Type:     note
# Tags:     #project #active
```

### id

Print the Foam identifier for a note.

```bash
foam note id (<identifier> | --path <path>)
```

Useful for resolving how Foam identifies a note when there could be ambiguity:

```bash
foam note id my-note
# my-note
```

### create

Create a new note.

```bash
foam note create [options]
```

| Option                 | Description                                  |
| ---------------------- | -------------------------------------------- |
| `--title <title>`      | Note title (default: `untitled`)             |
| `--dir <dir>`          | Directory relative to workspace root         |
| `--property <key=val>` | Add a frontmatter property (can be repeated) |

If a `new-note` template exists in `.foam/templates/`, it is used to generate the note content and file path. See [[templates]] for details.

Example:

```bash
foam note create --title "Meeting Notes" --dir meetings
# Created: meetings/meeting-notes.md  (id: meeting-notes)
```

### move

Move a note to a new path, rewriting all wikilinks that point to it.

```bash
foam note move (<identifier> | --path <path>) --to <new-path>
```

| Option          | Description                                   |
| --------------- | --------------------------------------------- |
| `--to <path>`   | Destination path (relative to workspace root) |
| `--path <path>` | Target by exact file path                     |

Example:

```bash
foam note move my-note --to archive/my-note.md
# Moved: notes/my-note.md → archive/my-note.md  (id: my-note, 3 links updated)
```

### delete

Delete a note.

```bash
foam note delete (<identifier> | --path <path>) [--force] [--permanent]
```

By default, deleted notes are moved to `.foam/trash/` rather than permanently removed. You will be prompted to confirm unless `--force` is passed.

| Option          | Description                                   |
| --------------- | --------------------------------------------- |
| `--force`       | Skip confirmation prompt                      |
| `--permanent`   | Delete permanently instead of moving to trash |
| `--path <path>` | Target by exact file path                     |

Example:

```bash
foam note delete old-draft
# Delete notes/old-draft.md? [y/N] y
# Trashed: notes/old-draft.md → .foam/trash/notes/old-draft.md
```

## Global options

| Option              | Description                                                                |
| ------------------- | -------------------------------------------------------------------------- |
| `--workspace <dir>` | Workspace root (default: `FOAM_WORKSPACE` env var, then current directory) |
| `--format <fmt>`    | Output format: `text` (default) or `json`                                  |

[templates]: ../../features/templates.md 'Note Templates'
