# @foam/cli

## 0.41.0

### Minor Changes

- Add colored output across all CLI commands, with auto-detection of TTY and respect for `NO_COLOR`

- Add `update` command and a passive non-blocking version check that notifies when a newer version of `foam-cli` is available

### Patch Changes

- Internal: Add `foam` script to run the built CLI locally

## 0.40.2

### Patch Changes

- Add unified config system shared between the extension and the CLI (#1638)

## 0.40.1

### Patch Changes

- Set up npm publishing for `@foam/cli` (released as `foam-cli`) and update installation instructions

## 0.40.0

### Minor Changes

- Reintroduce `foam-cli` as a standalone CLI built on top of `@foam/core`, providing commands for working with a Foam workspace from the terminal (#1636)
