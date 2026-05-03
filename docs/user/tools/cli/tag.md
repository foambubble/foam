# foam tag

List, rename, or search tags.

```
foam tag <subcommand> [options]
```

## Subcommands

### list

List all tags in the workspace.

```bash
foam tag list [options]
```

This is an alias for `foam list tags`. Accepts the same filtering and sorting options.

| Option                 | Description                  |
| ---------------------- | ---------------------------- |
| `--prefix <str>`       | Filter by tag prefix         |
| `--sort <count\|name>` | Sort order (default: `name`) |
| `--limit <n>`          | Maximum number of results    |

Example:

```bash
foam tag list
# #daily          (12 notes)
# #project        (8 notes)
# #project/active (3 notes)
```

### rename

Rename a tag across the entire workspace, including its hierarchical children.

```bash
foam tag rename <old> <new>
```

| Option    | Description                                                   |
| --------- | ------------------------------------------------------------- |
| `--force` | Skip confirmation if the rename would merge two existing tags |

Example:

```bash
foam tag rename todo in-progress
# Renamed: #todo → #in-progress  (5 notes updated)
```

Renaming a parent tag also renames its children. Renaming `project` to `work` will also rename `project/active` to `work/active`.

### search

Find all notes with a given tag.

```bash
foam tag search <tag>
```

This is an alias for `foam search --tag <tag>`.

Example:

```bash
foam tag search project
# notes/alpha.md:1: # Project Alpha
# notes/beta.md:1: # Project Beta
```

## Global options

| Option              | Description                                                                |
| ------------------- | -------------------------------------------------------------------------- |
| `--workspace <dir>` | Workspace root (default: `FOAM_WORKSPACE` env var, then current directory) |
| `--format <fmt>`    | Output format: `text` (default) or `json`                                  |

See also [[tags]] for tag management in VS Code.

[tags]: ../../features/tags.md 'Tags'
