# foam links

Show links to and from a note.

```
foam links (<identifier> | --path <path>) [options]
```

Displays the outgoing links (notes this note links to) and incoming links (notes that link to this note, also called backlinks). The command can also be invoked as `foam connections`.

## Options

| Option              | Description                                                                |
| ------------------- | -------------------------------------------------------------------------- |
| `--path <path>`     | Target note by exact file path instead of identifier                       |
| `--outgoing`        | Show only outgoing links                                                   |
| `--incoming`        | Show only incoming links (backlinks)                                       |
| `--workspace <dir>` | Workspace root (default: `FOAM_WORKSPACE` env var, then current directory) |
| `--format <fmt>`    | Output format: `text` (default) or `json`                                  |

By default, both outgoing and incoming links are shown.

## Examples

Show all links for a note:

```bash
foam links my-note
# Outgoing (2):
#   → related-topic    notes/related-topic.md
#   → another-note     notes/another-note.md
#
# Incoming (1):
#   ← index            index.md
```

Show only backlinks:

```bash
foam links my-note --incoming
```

Target by file path:

```bash
foam links --path notes/my-note.md
```

Get links as JSON for scripting:

```bash
foam links my-note --format json
```

## Note identifiers

Foam identifies notes by the shortest unique part of their filename (without extension). For example, a note at `projects/alpha/notes.md` might be identified as `notes` if that's unique, or `alpha/notes` if there's ambiguity. Use [[note|foam note id]] to check how a note is identified.

See also [[backlinking]] for the backlinks panel in VS Code.

[backlinking]: ../../features/backlinking.md 'Backlinks'
[note]: note.md 'foam note'
