import path from 'node:path';
import { FoamMcpServer, StdioServerTransport } from '@foam/mcp';
import {
  ITelemetryReporter,
  Logger,
  NoopTelemetryReporter,
} from '@foam/core';
import { loadWorkspaceFromDirectory } from '../support/filesystem';
import { NodeWatcher } from '../support/watcher';
import { parseArgs, getFlag, resolveWorkspaceDir } from '../support/args';
import type { CliLogger } from '../support/types';

export const MCP_HELP = `Usage: foam mcp [options]

Starts an MCP (Model Context Protocol) server over stdio. The server
exposes the workspace's knowledge graph and note content to AI agents
(Claude Desktop, Cursor, Zed, etc.).

The server is long-running: it loads the workspace once at startup and
watches the filesystem for changes so subsequent tool calls reflect the
latest state.

By default the server is read-only — pass --allow-writes to expose write
tools (create/update/delete/move resources and tag mutations).

Options:
  --workspace <dir>   Workspace root (default: FOAM_WORKSPACE env var, then cwd)
  --allow-writes      Register write tools. Off by default.
  --help              Show this help

Claude Desktop / mcp.json config:

  {
    "mcpServers": {
      "foam": {
        "command": "npx",
        "args": ["foam-cli", "mcp", "--workspace", "/path/to/workspace"]
      }
    }
  }

Logging:
  All log output goes to stderr (stdio is reserved for the MCP transport
  itself). Foam logs are silenced by default — set FOAM_LOG_LEVEL=info or
  =debug for diagnostic output.
`;

export interface McpArgs {
  workspaceDir: string;
  allowWrites: boolean;
}

export function parseMcpArgs(argv: string[]): McpArgs {
  const args = parseArgs(argv);
  return {
    workspaceDir: resolveWorkspaceDir(args),
    allowWrites: getFlag(args, 'allow-writes'),
  };
}

export async function runMcpCommand(
  args: McpArgs,
  logger: CliLogger,
  reporter: ITelemetryReporter = NoopTelemetryReporter
): Promise<number> {
  // The MCP transport owns stdout — anything written there is interpreted
  // as protocol messages. Send our own logs to stderr only.
  const logLevel = (process.env.FOAM_LOG_LEVEL as
    | 'debug'
    | 'info'
    | 'warn'
    | 'error'
    | undefined) ?? 'error';
  Logger.setLevel(logLevel);

  const rootDir = path.resolve(args.workspaceDir);
  logger.error(`[foam-mcp] Loading workspace: ${rootDir}`);

  // Watcher first — chokidar needs to be ignoring files that the workspace
  // matcher would ignore too, but `loadWorkspaceFromDirectory` builds the
  // matcher internally. To keep things simple in Phase 1 we watch the whole
  // root and let chokidar's `ignoreInitial` handle the bootstrap snapshot.
  const watcher = new NodeWatcher(rootDir, {
    ignored: [/(^|[\\/])\../, /node_modules/],
  });

  const { foam, rootUri } = await loadWorkspaceFromDirectory(rootDir, {
    watcher,
  });

  logger.error(
    `[foam-mcp] Workspace loaded: ${foam.workspace.list().length} resources, ${
      foam.graph.getAllConnections().length
    } connections`
  );

  // The dispatcher already forked the reporter for component='mcp' — this
  // command just routes it into FoamMcpServer.
  const server = new FoamMcpServer({
    foam,
    rootUri,
    mode: args.allowWrites ? 'read-write' : 'read',
    telemetry: reporter,
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.error('[foam-mcp] Listening on stdio.');

  // Block until the transport closes (client disconnects) or we get a signal.
  const shutdown = new Promise<void>(resolve => {
    const onSignal = () => resolve();
    process.once('SIGINT', onSignal);
    process.once('SIGTERM', onSignal);
    transport.onclose = () => resolve();
  });

  await shutdown;

  logger.error('[foam-mcp] Shutting down.');
  await server.close();
  await watcher.dispose();
  await reporter.dispose();
  return 0;
}
