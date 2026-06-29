import { FoamWorkspace, FoamGraph, URI, traverseGraph } from '@foam/core';

/**
 * Breadth-first traversal of outgoing links starting at `entryPoint`, up to
 * `depth` levels. Returns notes in BFS visitation order (entry point first).
 *
 * Constraints, matching the report spec:
 * - Placeholders are skipped (only resolved notes appear).
 * - Attachments and images are skipped — traversal follows note-to-note links
 *   only. Attachments are pulled in transitively at render time as needed.
 * - Cycles are handled: a note is added at most once.
 * - Within a level, links are followed in the order they appear in the source
 *   note (`graph.getLinks` preserves source order).
 */
export function collectNoteSet(
  workspace: FoamWorkspace,
  graph: FoamGraph,
  entryPoint: URI,
  depth: number
): URI[] {
  const entry = workspace.find(entryPoint);
  if (!entry || entry.type !== 'note') {
    return [];
  }

  const result = traverseGraph(workspace, graph, entry.uri, depth, 'links');
  return result.nodes.filter(n => n.type === 'note').map(n => n.uri);
}
