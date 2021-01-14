# Foam Core

This module contains the core functions, model, and API of Foam.
It is used by its clients to integrate Foam in various use cases, from VsCode extension, to CLI, to CI integrations.

## Local Development

Below is a list of commands you will probably find useful.

### `yarn watch`

Runs the project in development/watch mode. Your project will be rebuilt upon changes.

### `yarn build`

Bundles the package to the `dist` folder. The package is optimized and bundled with Rollup into multiple formats (CommonJS, UMD, and ES Module).

### `yarn test`

Runs the test watcher (Jest) in an interactive mode.
By default, runs tests related to files changed since the last commit.
