# foam list

List notes, tags, orphans, placeholders, dead-ends, or templates.

```
foam list <what> [options]
```

## What to list

| Value          | Description                                      |
| -------------- | ------------------------------------------------ |
| `notes`        | All notes in the workspace                       |
| `tags`         | All tags used across notes                       |
| `orphans`      | Notes with no links in or out                    |
| `deadends`     | Notes with no outgoing links                     |
| `placeholders` | Wikilinks that don't resolve to an existing note |
| `templates`    | Note templates in `.foam/templates/`             |

## Options

| Option                 | Description                                                                  |
| ---------------------- | ---------------------------------------------------------------------------- |
| `--type <type>`        | (notes) Filter by resource type: `note`, `daily-note`, `attachment`, `image` |
| `--tag <tag>`          | (notes) Filter by tag — repeat for multiple tags (AND logic)                 |
| `--limit <n>`          | (notes, tags) Maximum number of results                                      |
| `--prefix <str>`       | (tags) Filter by tag prefix                                                  |
| `--sort <count\|name>` | (tags) Sort order (default: `name`)                                          |
| `--workspace <dir>`    | Workspace root (default: `FOAM_WORKSPACE` env var, then current directory)   |
| `--format <fmt>`       | Output format: `text` (default) or `json`                                    |

## Examples

List all notes:

```bash
foam list notes
```

List notes with a specific tag:

```bash
foam list notes --tag project
```

List notes tagged both `project` and `active`:

```bash
foam list notes --tag project --tag active
```

List all tags sorted by usage count:

```bash
foam list tags --sort count
```

List tags starting with `project/`:

```bash
foam list tags --prefix project/
```

Find orphaned notes (no links in or out):

```bash
foam list orphans
```

Find broken wikilinks (links that don't resolve to a note):

```bash
foam list placeholders
```

List available templates:

```bash
foam list templates
```

See also [[orphans]] for the orphaned notes panel in VS Code, and [[tags]] for tag management in the editor.

[orphans]: ../orphans.md 'Orphaned Notes'
[tags]: ../../features/tags.md 'Tags'
