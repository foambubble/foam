# @foam/cli

Command-line interface for Foam knowledge bases. Interact with your Foam workspace from the terminal — no VS Code required.

## Installation

```bash
npm install -g foam-cli
```

Or run without installing:

```bash
npx foam-cli <command>
```

## Quick start

```bash
cd /path/to/your/notes

# See available commands
foam

# List all notes
foam list notes

# Run lint
foam lint
```

You can also pass `--workspace <dir>` on any command or set `FOAM_WORKSPACE` to avoid changing directory.

## Usage

```
foam <command> [options]

Global options:
  --workspace <dir>   Workspace root (default: FOAM_WORKSPACE env var, then cwd)
  --format <fmt>      Output format: text (default) or json
  --help              Show help
```

Run `foam <command> --help` for command-specific options.

### Workspace resolution

The workspace root is resolved in this order:

1. `--workspace <dir>` flag
2. `FOAM_WORKSPACE` environment variable
3. Current working directory

### Note targeting

Commands that operate on a note accept a positional `<identifier>` (resolved the same way as wikilinks — short name or alias) or `--path <path>` for an exact path. If an identifier matches more than one note the command exits `1` and lists the candidates.

### JSON output

All commands support `--format json`. Every JSON response includes `id` (the Foam short identifier, usable as a wikilink target) alongside `uri`.

### Exit codes

| Code | Meaning                   |
| ---- | ------------------------- |
| `0`  | Success                   |
| `1`  | Command error             |
| `2`  | Issues found (lint/check) |

`2` is CI-friendly: `foam lint || echo "issues found"`.

## Commands

### `lint`

Check workspace notes for issues.

```bash
foam lint
foam lint --fix
foam lint --rule missing-heading
foam lint --rule stale-definitions
```

Rules: `missing-heading`, `stale-definitions`. Exit code `2` when issues are found (CI-friendly).

### `list`

List notes, tags, orphans, placeholders, dead-ends, or templates.

```bash
foam list notes
foam list notes --type daily-note
foam list notes --tag project --tag active
foam list tags
foam list tags --sort count
foam list orphans
foam list deadends
foam list placeholders
foam list templates
```

### `note`

Show, create, move, or delete a note.

```bash
foam note show my-note
foam note show my-note --links          # include incoming/outgoing links
foam note show my-note --content        # print raw file content
foam note id my-note                    # print Foam identifier
foam note create --title "My Note"
foam note create --title "My Note" --dir subdir --property status=draft
foam note move my-note --to new-name.md
foam note delete my-note               # moves to .foam/trash/ (prompts for confirmation)
foam note delete my-note --force       # skip confirmation
foam note delete my-note --permanent   # delete permanently
```

### `outline`

Show the heading structure of a note.

```bash
foam outline my-note
foam outline --path path/to/note.md
```

### `links`

Show links to and from a note. Alias: `connections`.

```bash
foam links my-note
foam links my-note --outgoing
foam links my-note --incoming
```

### `daily`

Show or create the daily note for a date.

```bash
foam daily                             # today's note
foam daily --date 2025-01-15
foam daily --create                    # create if it doesn't exist
foam daily --path-only                 # print resolved path only (for scripting)
```

### `tag`

List, rename, or search tags.

```bash
foam tag list
foam tag search project
foam tag rename old-name new-name
foam tag rename old-name new-name --force   # skip merge confirmation
```

### `grep`

Search note content by regex pattern (no workspace graph needed).

```bash
foam grep "TODO"
foam grep "TODO" --context 2
foam grep "TODO" --limit 50
foam grep "TODO" --no-line-number
```

### `search`

Search notes by title, alias, tag, or frontmatter property.

```bash
foam search "meeting notes"
foam search --tag project
foam search --tag project --tag active      # AND filter
foam search --property status=draft
foam search --property status               # has the property (any value)
foam search --type daily-note
```

### `rename`

Rename a note, tag, section, or block anchor — with automatic wikilink rewriting across the workspace.

```bash
foam rename note my-note new-name
foam rename note my-note new-name --target-path subdir/
foam rename tag old-tag new-tag
foam rename tag old-tag new-tag --force     # allow merging tags
foam rename section my-note "Old Heading" "New Heading"
foam rename block my-note old-anchor new-anchor
```

## Contributing / running from source

```bash
# From the foam-cli package directory
cd packages/foam-cli
yarn build
node out/index.js <command>
```

For convenience you can alias it in your shell:

```bash
alias foam="node /path/to/foam/packages/foam-cli/out/index.js"
```

After making changes to the source, re-run `yarn build` to pick them up.
