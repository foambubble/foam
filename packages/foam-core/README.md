# @foam/core

Platform-agnostic core library for [Foam](https://foamnotes.com). Contains the business logic, data models, and services that power Foam, with no dependency on VS Code or any specific runtime environment.

## What's inside

- **Workspace & graph** — `FoamWorkspace` and `FoamGraph` manage resources and their connections
- **Markdown parsing** — parse notes, extract links, tags, frontmatter, and blocks
- **Resource providers** — `MarkdownResourceProvider` and `AttachmentResourceProvider` for pluggable file type support
- **Note creation** — template engine, variable resolution, and daily note support
- **Query engine** — DQL and JS-based queries for embedding dynamic content in notes
- **Link integrity** — compute rename edits for wikilinks and markdown links
- **Utilities** — logging, slugs, hashtags, path helpers, and more

## Usage

```ts
import { bootstrap, FoamWorkspace, FoamGraph } from '@foam/core';
```

This package is consumed by `foam-vscode` and is designed to be reusable in other environments (CLI, web, mobile).

## Development

From the repo root:

```sh
yarn workspace @foam/core test:unit   # run unit tests
yarn workspace @foam/core build       # compile TypeScript
yarn workspace @foam/core lint        # lint
```
