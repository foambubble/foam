foam-cli
========

Foam CLI

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/foam-cli.svg)](https://npmjs.org/package/foam-cli)
[![Downloads/week](https://img.shields.io/npm/dw/foam-cli.svg)](https://npmjs.org/package/foam-cli)
[![License](https://img.shields.io/npm/l/foam-cli.svg)](https://github.com/foambubble/foam/blob/master/package.json)

<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g foam-cli
$ foam COMMAND
running command...
$ foam (-v|--version|version)
foam-cli/0.11.0 darwin-x64 node-v12.18.2
$ foam --help [COMMAND]
USAGE
  $ foam COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`foam help [COMMAND]`](#foam-help-command)
* [`foam janitor [WORKSPACEPATH]`](#foam-janitor-workspacepath)
* [`foam migrate [WORKSPACEPATH]`](#foam-migrate-workspacepath)

## `foam help [COMMAND]`

display help for foam

```
USAGE
  $ foam help [COMMAND]

ARGUMENTS
  COMMAND  command to show help for

OPTIONS
  --all  see all commands in CLI
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v3.1.0/src/commands/help.ts)_

## `foam janitor [WORKSPACEPATH]`

Updates link references and heading across all the markdown files in the given workspaces

```
USAGE
  $ foam janitor [WORKSPACEPATH]

OPTIONS
  -h, --help                show CLI help
  -w, --without-extensions  generate link reference definitions without extensions (for legacy support)

EXAMPLE
  $ foam-cli janitor path-to-foam-workspace
```

_See code: [src/commands/janitor.ts](https://github.com/foambubble/foam/blob/v0.11.0/src/commands/janitor.ts)_

## `foam migrate [WORKSPACEPATH]`

Updates file names, link references and heading across all the markdown files in the given workspaces

```
USAGE
  $ foam migrate [WORKSPACEPATH]

OPTIONS
  -h, --help                show CLI help
  -w, --without-extensions  generate link reference definitions without extensions (for legacy support)

EXAMPLE
  $ foam-cli migrate path-to-foam-workspace
  Successfully generated link references and heading!
```

_See code: [src/commands/migrate.ts](https://github.com/foambubble/foam/blob/v0.11.0/src/commands/migrate.ts)_
<!-- commandsstop -->

## Development

- Run `yarn` somewhere in workspace (ideally root, see [yarn workspace docs](https://classic.yarnpkg.com/en/docs/workspaces/)
  - This will automatically symlink all package directories so you're using the local copy
- In `packages/foam-core`, run `yarn start` to rebuild the library on every change
- In `packages/foam-cli`, make changes and run with `yarn run cli`. This should use latest workspace manager changes.
