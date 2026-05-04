# Foam CLI

The `foam` command line tool lets you work with your Foam workspace from the terminal — search, inspect, and manage notes without opening VS Code.

## Installation

```bash
npm install -g foam-cli
```

## Usage

```
foam <command> [options]
```

Set the `FOAM_WORKSPACE` environment variable to avoid typing `--workspace` on every command:

```bash
export FOAM_WORKSPACE=/path/to/your/notes
```

All commands accept `--format json` for machine-readable output, useful for scripting.

## Commands

| Command     | Description                                       |
| ----------- | ------------------------------------------------- |
| [[daily]]   | Show or create the daily note for a date          |
| [[grep]]    | Search note content by pattern                    |
| [[links]]   | Show links to and from a note                     |
| [[lint]]    | Check notes for issues                            |
| [[list]]    | List notes, tags, orphans, placeholders, and more |
| [[note]]    | Show, create, move, or delete notes               |
| [[outline]] | Show the heading structure of a note              |
| [[rename]]  | Rename notes, tags, sections, or block anchors    |
| [[search]]  | Search notes by title, tag, or frontmatter        |
| [[tag]]     | List, rename, or search tags                      |

[daily]: cli/daily.md 'foam daily'
[grep]: cli/grep.md 'foam grep'
[links]: cli/links.md 'foam links'
[lint]: cli/lint.md 'foam lint'
[list]: cli/list.md 'foam list'
[note]: cli/note.md 'foam note'
[outline]: cli/outline.md 'foam outline'
[rename]: cli/rename.md 'foam rename'
[search]: cli/search.md 'foam search'
[tag]: cli/tag.md 'foam tag'
