import { FoamWorkspace, FoamGraph, URI } from '@foam/core';

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

  const visited = new Set<string>([entry.uri.toString()]);
  const ordered: URI[] = [entry.uri];

  let frontier: URI[] = [entry.uri];
  for (let level = 0; level < depth; level++) {
    const nextFrontier: URI[] = [];
    for (const uri of frontier) {
      const links = graph.getLinks(uri);
      for (const conn of links) {
        const target = workspace.find(conn.target);
        if (!target || target.type !== 'note') {
          continue;
        }
        const key = target.uri.toString();
        if (visited.has(key)) {
          continue;
        }
        visited.add(key);
        ordered.push(target.uri);
        nextFrontier.push(target.uri);
      }
    }
    if (nextFrontier.length === 0) {
      break;
    }
    frontier = nextFrontier;
  }

  return ordered;
}
