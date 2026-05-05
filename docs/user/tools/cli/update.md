# foam update

Check whether a newer version of `foam-cli` is available.

```
foam update
```

The command compares your installed version against the latest release on npm and prints the install command if a newer version exists. It does not install anything for you.

If the npm registry can't be reached, the command falls back to printing the install command without a version comparison.

## Options

| Option   | Description    |
| -------- | -------------- |
| `--help` | Show this help |

## Examples

Check for updates:

```bash
foam update
# Current version: 0.41.0
# Latest version:  0.42.0
#
# To update, run:
#   npm install -g foam-cli@latest
```

When already up to date:

```bash
foam update
# Current version: 0.42.0
# You are already on the latest version.
```
