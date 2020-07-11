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
foam-cli/0.1.0 darwin-x64 node-v12.18.0
$ foam --help [COMMAND]
USAGE
  $ foam COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`foam hello [FILE]`](#foam-hello-file)
* [`foam help [COMMAND]`](#foam-help-command)

## `foam hello [FILE]`

describe the command here

```
USAGE
  $ foam hello [FILE]

OPTIONS
  -f, --force
  -h, --help       show CLI help
  -n, --name=name  name to print

EXAMPLE
  $ foam hello
  hello world from ./src/hello.ts!
```

_See code: [src/commands/hello.ts](https://github.com/foambubble/foam/blob/v0.1.0/src/commands/hello.ts)_

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
<!-- commandsstop -->

## Development

- Run `yarn` somewhere in workspace (ideally root, see [yarn workspace docs](https://classic.yarnpkg.com/en/docs/workspaces/)
  - This will automatically symlink all package directories so you're using the local copy
- In `packages/foam-core`, run `yarn start` to rebuild the library on every change
- In `packages/foam-cli`, make changes and run with `yarn run cli`. This should use latest workspace manager changes.
