import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { Foam, URI } from '@foam/core';
import pkg from '../package.json';
import { registerResourceTools } from './tools/resources';
import { registerGraphTools } from './tools/graph';
import { registerTagTools } from './tools/tags';
import { registerSearchTools } from './tools/search';
import { registerStructureTools } from './tools/structure';

export interface FoamMcpServerOptions {
  /** Already-bootstrapped Foam instance. */
  foam: Foam;
  /** Workspace root used to resolve relative URIs at the wire boundary. */
  rootUri: URI;
  /**
   * If true, skip registering write tools (create/update/delete/move
   * resource and add/remove/rename tags). Defaults to false.
   */
  readOnly?: boolean;
}

const READ_ONLY_INSTRUCTIONS =
  'This Foam MCP server is running in read-only mode. ' +
  'Write tools (create_resource, update_resource, delete_resource, ' +
  'move_resource, add_tags, remove_tags, rename_tag) are not available. ' +
  'Call get_workspace_info to confirm the mode programmatically (read_only=true).';

/**
 * MCP server that exposes a Foam workspace's knowledge graph and content
 * to AI agents. Construct, then `connect(transport)` to start listening.
 *
 * The Foam instance is injected — this library does not pick a filesystem
 * or watcher implementation. The CLI uses `NodeFileDataStore` + `NodeWatcher`;
 * a future VS Code integration would use its own equivalents.
 */
export class FoamMcpServer {
  private readonly mcp: McpServer;

  constructor(opts: FoamMcpServerOptions) {
    this.mcp = new McpServer(
      { name: pkg.name, version: pkg.version },
      {
        capabilities: { tools: {} },
        instructions: opts.readOnly ? READ_ONLY_INSTRUCTIONS : undefined,
      }
    );

    const { foam, rootUri, readOnly = false } = opts;
    const dataStore = foam.services.dataStore;

    // Read-only tools always registered.
    registerStructureTools(this.mcp, foam, rootUri);
    registerGraphTools(this.mcp, foam, rootUri, { readOnly });
    registerSearchTools(this.mcp, foam, rootUri);

    // Modules that mix read and write tools accept a `readOnly` flag and
    // skip registering the writers entirely. Clients that list tools see
    // the actual capability surface.
    registerResourceTools(this.mcp, foam, dataStore, rootUri, { readOnly });
    registerTagTools(this.mcp, foam, dataStore, rootUri, { readOnly });
  }

  /** The underlying low-level MCP Server, exposed for advanced use cases. */
  get server() {
    return this.mcp.server;
  }

  async connect(transport: Transport): Promise<void> {
    await this.mcp.connect(transport);
  }

  async close(): Promise<void> {
    await this.mcp.close();
  }
}
