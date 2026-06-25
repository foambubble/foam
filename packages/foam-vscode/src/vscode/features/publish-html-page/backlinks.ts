import { FoamGraph, FoamWorkspace, URI } from '@foam/core';

export interface BacklinkEntry {
  sourceUri: URI;
  sourceTitle: string;
}

/**
 * Returns the backlinks to `target` whose source notes are also included in
 * the report (`includedUris`). Each source appears at most once even if it
 * links to the target multiple times.
 */
export function collectInReportBacklinks(
  workspace: FoamWorkspace,
  graph: FoamGraph,
  target: URI,
  includedUris: URI[]
): BacklinkEntry[] {
  const included = new Set(includedUris.map(u => u.toString()));
  const seenSources = new Set<string>();
  const entries: BacklinkEntry[] = [];

  for (const conn of graph.getBacklinks(target)) {
    const sourceKey = conn.source.toString();
    if (!included.has(sourceKey) || seenSources.has(sourceKey)) {
      continue;
    }
    const sourceResource = workspace.find(conn.source);
    if (!sourceResource) {
      continue;
    }
    seenSources.add(sourceKey);
    entries.push({
      sourceUri: conn.source,
      sourceTitle: sourceResource.title,
    });
  }

  return entries;
}
