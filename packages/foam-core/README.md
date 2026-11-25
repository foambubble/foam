# foam-core

The platform-agnostic core of [Foam](https://foam.md): it loads a workspace of Markdown notes, resolves wikilinks, and builds the graph of links between notes. The Foam VS Code extension, the Foam CLI and the Foam MCP server are all built on it.

```sh
npm install foam-core
```

- **Runtimes**: Node, and anything you can bundle for. The main entry point imports no `vscode` and no Node built-ins; every build bundles it for the browser to keep it that way.
- **Scripting**: `foam-core/scripting` runs user JavaScript through Node's `vm`, so it needs Node. See [Scripting](#scripting).
- **Modules**: CommonJS with TypeScript types; works with both `import` and `require`.

## Quick start

Load a folder of notes from disk, then look up a note's links and backlinks, links to notes that don't exist yet, and notes with no links at all:

```ts
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  ALWAYS_EXCLUDED,
  AttachmentResourceProvider,
  bootstrap,
  createMarkdownParser,
  GenericDataStore,
  GlobMatcher,
  listOrphans,
  listPlaceholders,
  MarkdownResourceProvider,
  resolveNote,
  URI,
} from 'foam-core';

const root = URI.file('/path/to/notes');

// Which files belong to the workspace (globs are relative to the root)
const matcher = new GlobMatcher([
  {
    uri: root,
    include: ['**/*'],
    exclude: [...ALWAYS_EXCLUDED, '**/node_modules/**'],
  },
]);

// How to list and read them
const listFiles = async () => {
  const entries = await readdir(root.toFsPath(), {
    recursive: true,
    withFileTypes: true,
  });
  const files = entries
    .filter(entry => entry.isFile())
    .map(entry => URI.file(join(entry.parentPath, entry.name)));
  return matcher.match(files);
};
const dataStore = new GenericDataStore(listFiles, uri =>
  readFile(uri.toFsPath(), 'utf8')
);

const parser = createMarkdownParser();
const foam = await bootstrap(
  [root],
  matcher,
  undefined, // no watcher: load a snapshot
  dataStore,
  parser,
  [
    new MarkdownResourceProvider(dataStore, parser),
    new AttachmentResourceProvider(),
  ]
);
const { workspace, graph } = foam;

// Find a note by the identifier you'd write in a [[wikilink]]
const note = resolveNote(workspace, { identifier: 'project-alpha' });
console.log(note.title);

for (const { target } of graph.getLinks(note.uri)) {
  console.log('links to', workspace.getIdentifier(target));
}
for (const { source } of graph.getBacklinks(note.uri)) {
  console.log('linked from', workspace.getIdentifier(source));
}

// Links to notes that don't exist yet
for (const placeholder of listPlaceholders(workspace, graph)) {
  console.log('missing', placeholder.placeholder_id);
}

// Notes with no links in or out
for (const orphan of listOrphans(workspace, graph)) {
  console.log('orphan', orphan.id);
}

foam.dispose();
```

```
Project Alpha
links to index
links to meeting-2024-05-02
linked from ideas
linked from index
missing meeting-2024-05-02
orphan lonely
```

Foam logs load timings to the console; `Logger.setLevel('warn')` quiets them.

## Concepts

| | |
| --- | --- |
| `bootstrap(roots, matcher, watcher, dataStore, parser, providers)` | Loads every matched file and returns a `Foam`: `{ workspace, graph, tags, dispose() }`. Pass an `IWatcher` (`onDidChange`, `onDidCreate`, `onDidDelete` events) to keep it in sync with changes on disk; without one you get a snapshot. |
| `FoamWorkspace` | The loaded resources. `find(identifierOrUri)`, `list()`, `getIdentifier(uri)` (the shortest unique name, as used in wikilinks), `listByIdentifier(name)`. |
| `FoamGraph` | The links between resources: `getLinks(uri)`, `getBacklinks(uri)`, `getAllConnections()`. A link to a note that doesn't exist becomes a placeholder node, listed in `graph.placeholders`. Updates when the workspace changes. |
| `FoamTags` | `tags.tags`: every tag, mapped to where it appears. |
| `Resource` | A parsed file: `uri`, `type` (`note`, `image`, `attachment`), `title`, `properties` (frontmatter), `tags`, `aliases`, `links`, `sections`, `blocks`, `tasks`. |
| `URI` | How Foam identifies files. `URI.file(fsPath)` and `uri.toFsPath()` convert at the edges; `uri.path` is always POSIX. Functions take and return URIs, not path strings. |
| `IDataStore` | How Foam lists, reads and writes files. Implement it for your storage, or wrap plain functions with `GenericDataStore`. |
| `IMatcher` | Decides which files are part of the workspace. `GlobMatcher` takes include/exclude globs per root. |
| `ResourceProvider` | Turns a file into a `Resource`. `MarkdownResourceProvider` handles notes (`.md` by default — pass other extensions as its third argument); `AttachmentResourceProvider` handles images plus any extensions you list (`defaultAttachmentExtensions` adds PDFs, audio, video and office documents). Add your own for other file types. |

## Operations

The Foam CLI and MCP server commands are built on these, so their source shows each one in use:

- **Read**: `listNotes`, `listTags`, `listOrphans`, `listDeadends`, `listPlaceholders`, `linksData`, `traverseGraph`, `searchWorkspace`, `outlineData`, `noteShowData`
- **Change files**: `renameNote`, `renameTag`, `renameSection`, `renameBlock`, `noteMove`, `noteDelete` — renames and moves also update every reference to what they change
- **Lint**: `lintWorkspace`
- **Query**: `executeQuery`
- **Export to a static site**: `buildSite`

Operations that change files write through the data store, so give `GenericDataStore` the rest of its functions — `write`, `delete`, `move`, `exists`, in that order — or implement `IDataStore`. For example:

```ts
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const dataStore = new GenericDataStore(
  listFiles, // as in the quick start
  uri => readFile(uri.toFsPath(), 'utf8'),
  async (uri, content) => {
    await mkdir(dirname(uri.toFsPath()), { recursive: true });
    await writeFile(uri.toFsPath(), content);
  },
  undefined, // delete
  undefined, // move
  async uri => existsSync(uri.toFsPath())
);
```

The CLI's [filesystem data store](https://github.com/foambubble/foam/blob/main/packages/foam-cli/src/support/filesystem.ts) and [watcher](https://github.com/foambubble/foam/blob/main/packages/foam-cli/src/support/watcher.ts) are complete Node implementations.

## Scripting

Templates and queries can be written in JavaScript, which Foam runs in Node's `vm`. Everything that may run that code lives in `foam-core/scripting`, so the main entry point stays bundleable outside Node:

- `noteCreate` — create a note from the workspace's `.foam/templates/new-note.md` (or `.js`)
- `resolveDailyNote` — the path and content of a date's daily note, from its template
- `TemplateLoader` — load a Markdown or JavaScript template
- `renderJsQuery` — render a `foam-query-js` block

```ts
import { noteCreate } from 'foam-core/scripting';

// Writes through the data store, so it needs `write` and `exists` (see above).
// The last argument lets JavaScript templates run: pass true only for
// workspaces you trust.
const { uri } = await noteCreate(
  foam,
  dataStore,
  { title: 'Weekly review', dir: 'journal' },
  false
);
```

## Development

From the repo root:

```sh
yarn workspace @foam/core test:unit   # run unit tests
yarn workspace @foam/core build       # compile TypeScript
yarn workspace @foam/core lint        # lint
```

In this repository the package is named `@foam/core`; it's published to npm as `foam-core`.
