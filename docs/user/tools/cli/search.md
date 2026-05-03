# foam search

Search notes by title, alias, tag, or frontmatter property.

```
foam search [<query>] [options]
```

Searches the workspace index. The optional `<query>` is matched against note titles and aliases (substring, case-insensitive). Combine it with `--tag` and `--property` filters to narrow results.

For full-text content search, use [[cli-grep|foam grep]] instead.

## Options

| Option                 | Description                                                                    |
| ---------------------- | ------------------------------------------------------------------------------ |
| `<query>`              | Substring to match against note titles and aliases                             |
| `--tag <tag>`          | Filter by tag (repeat for AND logic)                                           |
| `--property <key=val>` | Filter by frontmatter property; omit `=val` to match any note that has the key |
| `--type <type>`        | Filter by resource type: `note`, `daily-note`, `attachment`, `image`           |
| `--limit <n>`          | Maximum number of results (default: 20)                                        |
| `--workspace <dir>`    | Workspace root (default: `FOAM_WORKSPACE` env var, then current directory)     |
| `--format <fmt>`       | Output format: `text` (default) or `json`                                      |

## Examples

Search by title:

```bash
foam search "meeting"
# notes/team-meeting.md:1: # Team Meeting Notes
# notes/one-on-one-meeting.md:1: # One-on-One Meeting
```

Filter by tag:

```bash
foam search --tag project
```

Combine a title query with a tag filter:

```bash
foam search "alpha" --tag active
```

Find all notes with a specific frontmatter property:

```bash
foam search --property status=draft
```

Find all notes that have a `due` property (any value):

```bash
foam search --property due
```

List only daily notes:

```bash
foam search --type daily-note
```
