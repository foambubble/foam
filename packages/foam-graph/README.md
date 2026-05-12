# @foam/graph-view

Graph visualization web component for [Foam](https://foamnotes.com), built with [Lit](https://lit.dev) and [force-graph](https://github.com/vasturiano/force-graph).

Bundled for use inside the Foam VS Code extension webview.

## What's inside

- **`<foam-graph>` web component** — interactive force-directed graph of notes and connections
- **Protocol** — shared message types (`GraphData`, `NodeInfo`, `StyleConfig`, …) for communication between the extension host and the webview
- **Configurable styling** — node colors, grouping, font, background, and visibility per node type

## Usage

```ts
import '@foam/graph-view';                        // register the web component
import type { GraphData } from '@foam/graph-view/protocol';  // message types
```

## Development

From the repo root:

```sh
yarn workspace @foam/graph-view test:unit     # run unit tests
yarn workspace @foam/graph-view build         # build lib + VS Code bundle
yarn workspace @foam/graph-view watch         # watch mode (VS Code bundle)
yarn workspace @foam/graph-view lint          # lint
```
