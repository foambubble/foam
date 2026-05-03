# foam lint

Check notes for issues.

```
foam lint [options]
```

Scans all notes in the workspace and reports problems such as missing headings or stale link reference definitions. With `--fix`, auto-fixable issues are corrected in place.

Exits with code `2` when issues are found (and no `--fix`), making it easy to use in CI pipelines.

## Options

| Option              | Description                                                                |
| ------------------- | -------------------------------------------------------------------------- |
| `--fix`             | Apply all auto-fixable issues                                              |
| `--rule <id>`       | Run only the given rule (can be repeated)                                  |
| `--workspace <dir>` | Workspace root (default: `FOAM_WORKSPACE` env var, then current directory) |
| `--format <fmt>`    | Output format: `text` (default) or `json`                                  |

## Rules

| Rule ID             | Description                                            | Auto-fixable |
| ------------------- | ------------------------------------------------------ | :----------: |
| `missing-heading`   | Notes without a top-level heading                      |     Yes      |
| `stale-definitions` | Link reference definitions that are outdated or unused |     Yes      |

## Exit codes

| Code | Meaning         |
| ---- | --------------- |
| `0`  | No issues found |
| `1`  | Command error   |
| `2`  | Issues found    |

## Examples

Check the workspace for issues:

```bash
foam lint
# notes/my-note.md
#   5:1  warning  Missing heading  missing-heading
#
# 1 problem (0 errors, 1 warning, 1 fixable with --fix)
```

Fix all auto-fixable issues:

```bash
foam lint --fix
```

Run only one rule:

```bash
foam lint --rule missing-heading
```

Use in CI:

```bash
foam lint || echo "Lint issues found — please fix before merging"
```

Get results as JSON:

```bash
foam lint --format json
```

See also [[workspace-janitor]] for running the janitor from VS Code.

[workspace-janitor]: ../workspace-janitor.md 'Workspace Janitor'
