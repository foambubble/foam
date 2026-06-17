# @foam/mcp

[Model Context Protocol](https://modelcontextprotocol.io) server library for Foam. Exposes a Foam workspace's knowledge graph and note content to AI agents.

This is a **library**, not an executable. It depends only on [`@foam/core`](../foam-core), [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk), and `zod` — the filesystem, watcher, and transport are injected by the consumer.

End users should use [`foam-cli`](../foam-cli)'s `foam mcp` subcommand, which wires this library to a `NodeFileDataStore` + `NodeWatcher` and stdio transport. See the [user docs](../../docs/user/tools/cli/mcp.md) for setup.

## Usage

```typescript
import { FoamMcpServer, StdioServerTransport } from '@foam/mcp';
import { bootstrap, QueryStore, URI } from '@foam/core';

const rootUri = URI.file('/path/to/workspace');

// Bootstrap a Foam instance. The dataStore and watcher are yours to provide.
const foam = await bootstrap(
  [rootUri],
  matcher,
  watcher,        // optional — IWatcher implementation keeps the graph fresh
  dataStore,      // IDataStore implementation
  parser,
  providers,
  '.md',
  'off'
);

// Saved queries — backs the list_queries / get_query / run_query tools.
const queryStore = new QueryStore(dataStore, rootUri);

const server = new FoamMcpServer({
  foam,
  rootUri,
  mode: 'read',   // 'read' or 'read-write' — required
  queryStore,
});

await server.connect(new StdioServerTransport());
```

`mode` is required: callers must make an explicit choice. `'read'` skips registering write tools (create / update / delete / move resources, and tag mutations); `'read-write'` enables them.

## Tools

Tools are organised into five modules, each registered by the server constructor.

### Resources

| Tool                | Mode       | Description                                            |
| ------------------- | ---------- | ------------------------------------------------------ |
| `list_resources`    | read       | List notes filtered by type and/or tag                 |
| `get_resource`      | read       | Get metadata for a note by URI or identifier           |
| `read_resource`     | read       | Read the raw markdown content of a note                |
| `create_resource`   | read-write | Create a note from content + frontmatter properties    |
| `update_resource`   | read-write | Replace content or merge frontmatter properties        |
| `delete_resource`   | read-write | Delete a note (requires `confirm: true`)               |
| `move_resource`     | read-write | Move a note and rewrite incoming links                 |

### Graph

| Tool                  | Mode | Description                                          |
| --------------------- | ---- | ---------------------------------------------------- |
| `get_workspace_info`  | read | Counts and `read_only` flag                          |
| `get_connections`     | read | Outgoing links, incoming links, or both              |
| `get_orphans`         | read | Notes with no links in or out                        |
| `get_deadends`        | read | Notes with no outgoing links                         |
| `get_placeholders`    | read | Unresolved wikilink targets and their referrers      |
| `traverse_graph`      | read | BFS up to a given depth, capped at 5                 |
| `get_graph_summary`   | read | Aggregate stats: most-connected notes, top tags, etc.|

### Tags

| Tool            | Mode       | Description                                  |
| --------------- | ---------- | -------------------------------------------- |
| `list_tags`     | read       | All tags, optionally filtered by prefix      |
| `search_by_tag` | read       | Notes carrying a given tag                   |
| `add_tags`      | read-write | Add tags to a note's frontmatter             |
| `remove_tags`   | read-write | Remove tags from a note's frontmatter        |
| `rename_tag`    | read-write | Rename a tag across the whole workspace      |

### Search

| Tool                  | Mode | Description                                |
| --------------------- | ---- | ------------------------------------------ |
| `search_resources`    | read | Full-text search across notes              |
| `search_by_property`  | read | Search by frontmatter property/value       |

### Structure

| Tool          | Mode | Description                              |
| ------------- | ---- | ---------------------------------------- |
| `get_outline` | read | Heading structure of a note              |

### Saved queries

| Tool            | Mode | Description                                                                                |
| --------------- | ---- | ------------------------------------------------------------------------------------------ |
| `list_queries`  | read | List saved queries (the YAML files under `.foam/queries/`) with match counts               |
| `get_query`     | read | Return the descriptor + metadata for a saved query by id                                   |
| `run_query`     | read | Execute a saved query by `id` **or** an ad-hoc `descriptor` (exactly one)                  |

## URI convention at the wire boundary

Inputs and outputs use **workspace-relative POSIX paths** as strings (e.g. `notes/project.md`). Absolute paths (`/foo/bar.md`) and `file://` URIs are also accepted on input. Internally the library converts to `URI` objects immediately and passes `URI` to every `@foam/core` call — keeping the project-wide rule "URIs throughout, paths only at the edges".

Placeholder URIs use the `placeholder:<identifier>` wire format because placeholders don't correspond to a file path.

## Errors

Tool handlers convert `FoamError` (thrown by `@foam/core` commands) into structured MCP error responses with the original error code:

| `FoamErrorCode`         | Meaning                                                |
| ----------------------- | ------------------------------------------------------ |
| `resource_not_found`    | URI or identifier didn't resolve to a resource         |
| `ambiguous_identifier`  | The identifier matched more than one resource          |
| `resource_exists`       | Tried to create over an existing file                  |
| `invalid_input`         | Schema validation failed, or `confirm: false` on delete |
| `io_error`              | Anything else (catch-all)                              |

Anything unexpected becomes `io_error`. Mapping lives in [`src/errors.ts`](src/errors.ts).

## Telemetry

`FoamMcpServer` accepts an optional `ITelemetryReporter`. When provided it emits:

- `mcp.session-started` — once when the client completes the `initialize` handshake. Carries `mode`, bucketed `noteCount`/`attachmentCount`, and the client name if exposed.
- `mcp.session-with-tool` — once per session, on the first tool call.
- `mcp.tool-invoked` — per tool call, with `tool` name, `durationBucket`, and `outcome` (`success`/`error`).
- `mcp.error` — safety net for errors that escape per-tool wrapping.

Tool arguments and returned content are **never** included. See the [telemetry docs](../../docs/user/tools/telemetry.md) for the full event schema.

The default reporter is a no-op — telemetry is opt-in for embedded consumers.

## Testing

```bash
yarn workspace @foam/mcp test
```

Tests use the `withMcpServer` helper from [`src/test-setup.ts`](src/test-setup.ts), which wires a real `@modelcontextprotocol/sdk` client and server over an `InMemoryTransport` against a seeded `InMemoryDataStore` — no temp directories, no real I/O.

To manually drive the server with [MCP Inspector](https://github.com/modelcontextprotocol/inspector):

```bash
yarn workspace @foam/cli build
npx @modelcontextprotocol/inspector node packages/foam-cli/out/index.js mcp --workspace /path/to/workspace
```
