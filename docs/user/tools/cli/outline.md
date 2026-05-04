# foam outline

Show the heading structure of a note.

```
foam outline (<identifier> | --path <path>) [options]
```

Prints the headings in a note in order, indented to reflect their level. Useful for getting a quick overview of a long note's structure.

## Options

| Option              | Description                                                                |
| ------------------- | -------------------------------------------------------------------------- |
| `--path <path>`     | Target note by exact file path instead of identifier                       |
| `--workspace <dir>` | Workspace root (default: `FOAM_WORKSPACE` env var, then current directory) |
| `--format <fmt>`    | Output format: `text` (default) or `json`                                  |

## Examples

Show the outline of a note:

```bash
foam outline my-note
# # Introduction
# ## Background
# ## Goals
# # Implementation
# ## Phase 1
# ## Phase 2
# # Conclusion
```

Get the outline as JSON (includes line numbers):

```bash
foam outline my-note --format json
```

Target by file path:

```bash
foam outline --path notes/my-note.md
```
