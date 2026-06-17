import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  Foam,
  ITelemetryReporter,
  NoopTelemetryReporter,
  QueryStore,
  URI,
  bucketNoteCount,
} from '@foam/core';
import pkg from '../package.json';
import { withToolErrorHandling } from './errors';
import { withToolTelemetry } from './telemetry';
import { registerResourceTools } from './tools/resources';
import { registerGraphTools } from './tools/graph';
import { registerQueryTools } from './tools/queries';
import { registerTagTools } from './tools/tags';
import { registerSearchTools } from './tools/search';
import { registerStructureTools } from './tools/structure';

/**
 * Pre-bound `registerTool` helper handed to tool modules. Has the same
 * signature as {@link McpServer.registerTool} (so zod-shape inference on
 * handler args still works at the call site), but every handler is
 * automatically wrapped with error handling and telemetry — there is
 * exactly one composition point.
 */
export type ToolRegistrar = McpServer['registerTool'];

/**
 * Server access mode. `'read'` exposes only read tools; `'read-write'`
 * additionally registers write tools (create/update/delete/move resource
 * and add/remove/rename tags). Required — consumers must make an explicit
 * choice rather than rely on a default.
 */
export type FoamMcpServerMode = 'read' | 'read-write';

export interface FoamMcpServerOptions {
  /** Already-bootstrapped Foam instance. */
  foam: Foam;
  /** Workspace root used to resolve relative URIs at the wire boundary. */
  rootUri: URI;
  /** Access mode. See {@link FoamMcpServerMode}. */
  mode: FoamMcpServerMode;
  /**
   * Store for saved queries (Smart Folders). 
   */
  queryStore: QueryStore;
  /**
   * Reporter receiving `mcp.*` events. Defaults to a noop so unhosted
   * consumers (tests, embedded uses) don't have to wire telemetry in.
   *
   * Hosts that emit `mcp.*` events should construct a reporter with
   * `component: 'mcp'` even if they also emit `cli.*` / `vscode.*` from a
   * sibling reporter — common properties stay honest that way.
   */
  telemetry?: ITelemetryReporter;
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
  private readonly telemetry: ITelemetryReporter;
  private readonly foam: Foam;
  private readonly mode: FoamMcpServerMode;
  private sessionWithToolFired = false;

  constructor(opts: FoamMcpServerOptions) {
    const readOnly = opts.mode === 'read';
    this.mcp = new McpServer(
      { name: pkg.name, version: pkg.version },
      {
        capabilities: { tools: {} },
        instructions: readOnly ? READ_ONLY_INSTRUCTIONS : undefined,
      }
    );

    this.telemetry = opts.telemetry ?? NoopTelemetryReporter;
    this.foam = opts.foam;
    this.mode = opts.mode;

    const { foam, rootUri } = opts;
    const dataStore = foam.services.dataStore;
    const register = this.makeRegisterTool();

    // Read-only tools always registered.
    registerStructureTools(register, foam, rootUri);
    registerGraphTools(register, foam, rootUri, { readOnly });
    registerSearchTools(register, foam, rootUri);
    registerQueryTools(register, foam, opts.queryStore, rootUri);

    // Modules that mix read and write tools accept a `readOnly` flag and
    // skip registering the writers entirely. Clients that list tools see
    // the actual capability surface.
    registerResourceTools(register, foam, dataStore, rootUri, { readOnly });
    registerTagTools(register, foam, dataStore, rootUri, { readOnly });

    // The MCP SDK fires `oninitialized` once the client has sent its
    // `initialized` notification — at which point `getClientVersion()` has
    // the client's name/version. We fire mcp.session-started there so we
    // can carry the `client` property.
    this.mcp.server.oninitialized = () => this.fireSessionStarted();
  }

  /**
   * Returns a `registerTool` helper bound to this server. Tool modules use
   * it to register tools without knowing about the SDK call, the error
   * wrapper, or the telemetry wrapper — all three are composed here.
   */
  private makeRegisterTool(): ToolRegistrar {
    const onToolInvoked = () => {
      if (!this.sessionWithToolFired) {
        this.sessionWithToolFired = true;
        this.telemetry.trackEvent('mcp.session-with-tool');
      }
    };
    // Runtime: forward to mcp.registerTool with the handler wrapped through
    // error handling + telemetry. We cast the resulting closure back to the
    // SDK's overloaded signature — the per-tool zod-shape inference at the
    // call site survives because we don't constrain the handler shape here.
    const fn = (
      name: string,
      config: Parameters<ToolRegistrar>[1],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handler: any
    ): ReturnType<ToolRegistrar> => {
      const wrapped = withToolTelemetry(
        this.telemetry,
        name,
        onToolInvoked,
        withToolErrorHandling(handler)
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (this.mcp.registerTool as any)(name, config, wrapped);
    };
    return fn as ToolRegistrar;
  }

  private fireSessionStarted(): void {
    const resources = this.foam.workspace.list();
    const noteCount = resources.filter(r => r.type === 'note').length;
    const attachmentCount = resources.filter(
      r => r.type === 'image' || r.type === 'attachment'
    ).length;
    const properties: Record<string, string> = {
      mode: this.mode,
      noteCount: bucketNoteCount(noteCount),
      attachmentCount: bucketNoteCount(attachmentCount),
    };
    const clientImpl = this.mcp.server.getClientVersion();
    if (clientImpl?.name) {
      // The client picks its own `name` — it's untrusted text. We don't
      // want an arbitrarily long string flowing into telemetry, so cap it.
      // 32 chars is enough for every known client (`claude-desktop`,
      // `cursor`, `cline`, …) and bounds the worst case.
      properties.client = clientImpl.name.slice(0, 32);
    }
    this.telemetry.trackEvent('mcp.session-started', properties);
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
