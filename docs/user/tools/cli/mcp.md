# foam mcp

Run a [Model Context Protocol](https://modelcontextprotocol.io) server over stdio so AI agents (Claude Desktop, Cursor, Zed, …) can read and traverse your Foam workspace as a knowledge graph instead of grepping files.

```
foam mcp [options]
```

The server stays running for the whole agent session: it loads the workspace once at startup and watches the filesystem so subsequent tool calls reflect notes you edited in your editor.

## Options

| Option              | Description                                                                |
| ------------------- | -------------------------------------------------------------------------- |
| `--workspace <dir>` | Workspace root (default: `FOAM_WORKSPACE` env var, then current directory) |
| `--allow-writes`    | Let the agent create, edit, delete, and rename notes and tags. Off by default. |

By default the server is **read-only**. Add `--allow-writes` to let the agent modify your notes.

## Connecting an AI client

Most MCP clients accept a JSON configuration similar to this — point them at `foam-cli`:

```json
{
  "mcpServers": {
    "foam": {
      "command": "npx",
      "args": ["foam-cli", "mcp", "--workspace", "/path/to/your/notes"]
    }
  }
}
```

For Claude Desktop the file is `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS and `%APPDATA%\Claude\claude_desktop_config.json` on Windows. Restart the client after editing.

To allow the agent to edit notes too, add `"--allow-writes"` to the `args` array.

## What the agent can do

Read tools (always available):

- Browse the workspace (`list_resources`, `get_resource`, `read_resource`, `get_workspace_info`)
- Follow the link graph (`get_connections`, `traverse_graph`, `get_orphans`, `get_deadends`, `get_placeholders`, `get_graph_summary`)
- Search by tag, frontmatter property, or text (`list_tags`, `search_by_tag`, `search_by_property`, `search_resources`)
- Inspect note structure (`get_outline`)

Write tools (only with `--allow-writes`):

- Create, update, delete, and move notes (`create_resource`, `update_resource`, `delete_resource`, `move_resource`)
- Add, remove, or rename tags (`add_tags`, `remove_tags`, `rename_tag`)

## Logs

Foam writes its logs to stderr (stdout is reserved for MCP traffic). To increase verbosity for troubleshooting:

```bash
FOAM_LOG_LEVEL=debug foam mcp --workspace /path/to/notes
```

Valid values: `debug`, `info`, `warn`, `error` (default).
