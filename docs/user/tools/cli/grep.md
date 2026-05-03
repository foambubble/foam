# foam grep

Search note content by pattern.

```
foam grep <pattern> [options]
```

Searches the text content of all notes in the workspace. The pattern is matched case-insensitively as a regular expression. Unlike [[search|foam search]], this command searches the full text of each note rather than indexed metadata.

## Options

| Option              | Description                                                                |
| ------------------- | -------------------------------------------------------------------------- |
| `--context <n>`     | Show `n` lines of surrounding context around each match                    |
| `--no-line-number`  | Omit line numbers from output                                              |
| `--limit <n>`       | Max number of matching files to return (default: 20)                       |
| `--workspace <dir>` | Workspace root (default: `FOAM_WORKSPACE` env var, then current directory) |
| `--format <fmt>`    | Output format: `text` (default) or `json`                                  |

## Examples

Search for a word across all notes:

```bash
foam grep "quantum"
# physics/quantum-mechanics.md:3: Quantum mechanics describes...
# research/reading-list.md:12: See also quantum entanglement
```

Search with context lines:

```bash
foam grep "TODO" --context 2
```

Limit results:

```bash
foam grep "meeting" --limit 5
```

Use in a script (JSON output):

```bash
foam grep "action item" --format json
```

[search]: search.md 'foam search'
