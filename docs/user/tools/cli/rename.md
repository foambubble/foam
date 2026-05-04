# foam rename

Rename notes, tags, sections, or block anchors — with automatic link rewriting.

```
foam rename <subcommand> [options]
```

All subcommands update every wikilink that references the renamed item across the whole workspace.

## Subcommands

### note

Rename a note file and rewrite all wikilinks pointing to it.

```bash
foam rename note (<identifier> | --path <path>) <new-name>
```

| Option                 | Description                            |
| ---------------------- | -------------------------------------- |
| `--target-path <path>` | Move the file to a different directory |
| `--path <path>`        | Target by exact file path              |

Example:

```bash
foam rename note old-name new-name
# Renamed: notes/old-name.md → notes/new-name.md  (id: new-name, 4 links updated)
```

Move to a different directory at the same time:

```bash
foam rename note my-note my-note --target-path archive/
```

### tag

Rename a tag and all its hierarchical children across the workspace.

```bash
foam rename tag <old-tag> <new-tag>
```

| Option    | Description                                                   |
| --------- | ------------------------------------------------------------- |
| `--force` | Skip confirmation if the rename would merge two existing tags |

Example:

```bash
foam rename tag project/active project/in-progress
# Renamed: #project/active → #project/in-progress  (3 notes updated)
```

### section

Rename a heading section in a note and rewrite all `[[note#Section]]` links pointing to it.

```bash
foam rename section (<identifier> | --path <path>) <old-label> <new-label>
```

| Option          | Description               |
| --------------- | ------------------------- |
| `--path <path>` | Target by exact file path |

Example:

```bash
foam rename section my-note "Background" "Context"
# Renamed section "Background" → "Context" in notes/my-note.md  (2 links updated)
```

### block

Rename a block anchor in a note and rewrite all `[[note#^id]]` links pointing to it.

```bash
foam rename block (<identifier> | --path <path>) <old-id> <new-id>
```

| Option          | Description               |
| --------------- | ------------------------- |
| `--path <path>` | Target by exact file path |

Example:

```bash
foam rename block my-note key-insight better-insight
# Renamed block ^key-insight → ^better-insight in notes/my-note.md  (1 link updated)
```

## Global options

| Option              | Description                                                                |
| ------------------- | -------------------------------------------------------------------------- |
| `--workspace <dir>` | Workspace root (default: `FOAM_WORKSPACE` env var, then current directory) |
| `--format <fmt>`    | Output format: `text` (default) or `json`                                  |

See also [[wikilinks]] for how wikilinks work, and [[block-anchors]] for block anchor syntax.

[wikilinks]: ../../features/wikilinks.md 'Wikilinks'
[block-anchors]: ../../features/block-anchors.md 'Block Anchors'
