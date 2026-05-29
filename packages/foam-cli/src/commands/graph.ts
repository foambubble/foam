import { buildGraphData, uriToWorkspacePath } from '@foam/core';
import { loadWorkspaceFromDirectory } from '../support/filesystem';
import { parseArgs, getFlag, resolveWorkspaceDir } from '../support/args';
import type { CliLogger } from '../support/types';

export const GRAPH_HELP = `Usage: foam graph [options]

Export the workspace link graph as JSON to stdout.

The output shape is compatible with d3-force and similar graph libraries:
  { "nodes": [ { "id", "type", "title", "properties", "tags" }, ... ],
    "links": [ { "source", "target" }, ... ] }

Node IDs are workspace-relative POSIX paths.

Pipe to a file or another tool:
  foam graph > graph.json
  foam graph | jq '.nodes | length'

Options:
  --include-placeholders   Include broken-link targets as placeholder nodes
  --workspace <dir>        Workspace root (default: FOAM_WORKSPACE env var, then cwd)
  --help                   Show this help
`;

export async function runGraphCommand(
  argv: string[],
  logger: CliLogger
): Promise<number> {
  const parsed = parseArgs(argv);

  if (getFlag(parsed, 'help')) {
    logger.info(GRAPH_HELP);
    return 0;
  }

  const includePlaceholders = getFlag(parsed, 'include-placeholders');
  const workspaceDir = resolveWorkspaceDir(parsed);

  try {
    const { foam, workspace } = await loadWorkspaceFromDirectory(workspaceDir);
    const { nodeInfo, links } = buildGraphData(
      workspace.list(),
      foam.graph.getAllConnections(),
      {
        resourceToId: uri => uriToWorkspacePath(uri, workspace),
        includePlaceholders,
      }
    );

    const output = { nodes: Object.values(nodeInfo), links };
    logger.info(JSON.stringify(output, null, 2));
    return 0;
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
}
