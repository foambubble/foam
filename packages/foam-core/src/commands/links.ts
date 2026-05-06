import { FoamGraph } from '../model/graph';
import { Resource } from '../model/note';
import { FoamWorkspace } from '../model/workspace';
import { URI } from '../model/uri';

export interface LinkEntry {
  id: string;
  uri: URI;
  title: string;
  label?: string;
}

export interface LinksResult {
  id: string;
  uri: URI;
  outgoing: LinkEntry[];
  incoming: LinkEntry[];
}

/**
 * Returns outgoing and incoming links for a resource.
 */
export function linksData(
  workspace: FoamWorkspace,
  graph: FoamGraph,
  resource: Resource
): LinksResult {
  const id = workspace.getIdentifier(resource.uri);

  const outgoing = graph.getLinks(resource.uri).map(c => {
    const target = workspace.find(c.target);
    return {
      id: workspace.getIdentifier(c.target),
      uri: c.target,
      title: target?.title ?? '',
      label: c.link.rawText,
    };
  });

  const incoming = graph.getBacklinks(resource.uri).map(c => {
    const source = workspace.find(c.source);
    return {
      id: workspace.getIdentifier(c.source),
      uri: c.source,
      title: source?.title ?? '',
      label: c.link.rawText,
    };
  });

  return {
    id,
    uri: resource.uri,
    outgoing,
    incoming,
  };
}
