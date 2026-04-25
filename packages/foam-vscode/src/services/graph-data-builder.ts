import type { Resource } from '../core/model/note';
import type { Connection } from '../core/model/graph';
import type { URI } from '../core/model/uri';

export interface GraphNodeData {
  id: string;
  type: string;
  title: string;
  properties: { color?: string; [key: string]: unknown };
  tags: Array<{ label: string }>;
}

export interface BuiltGraphData {
  nodeInfo: Record<string, GraphNodeData>;
  links: Array<{ source: string; target: string }>;
}

export interface GraphBuilderOptions {
  /**
   * Maps a resource URI to the node ID used in the graph.
   *
   * Serves two purposes:
   * - **ID mapping**: transforms the URI into whatever string the graph uses as
   *   an identifier (e.g. the file path for the VS Code webview, or a published
   *   URL route for the static site).
   * - **Filtering**: returning `undefined` excludes the resource (and any
   *   connections to/from it) from the graph. Use this to restrict the graph to
   *   a subset of resources — e.g. only published notes, only notes marked as
   *   public, etc.
   *
   * Note: `resourceToId` is only called for real resources, not for placeholder
   * URIs. Placeholder inclusion is controlled separately by `includePlaceholders`.
   */
  resourceToId: (uri: URI) => string | undefined;
  /**
   * Optional title transform applied before storing. Defaults to identity.
   */
  transformTitle?: (title: string, resource: Resource) => string;
  /**
   * Whether to include placeholder nodes — synthetic nodes created for link
   * targets that don't correspond to any real resource (i.e. broken links).
   *
   * Placeholders are implicitly included whenever their source resource is
   * included: they have no independent existence and only matter because
   * something links to them. Setting this to `false` suppresses them even
   * when their source is included. Defaults to `false`.
   */
  includePlaceholders?: boolean;
}

export function buildGraphData(
  resources: Resource[],
  connections: Connection[],
  options: GraphBuilderOptions
): BuiltGraphData {
  const { resourceToId, transformTitle, includePlaceholders = false } = options;
  const nodeInfo: Record<string, GraphNodeData> = {};
  const links = new Map<string, { source: string; target: string }>();

  for (const resource of resources) {
    const id = resourceToId(resource.uri);
    if (id === undefined) {
      continue;
    }
    const rawTitle =
      resource.type === 'note' ? resource.title : resource.uri.getBasename();
    const title = transformTitle ? transformTitle(rawTitle, resource) : rawTitle;
    nodeInfo[id] = {
      id,
      type:
        resource.type === 'note'
          ? resource.properties.type ?? 'note'
          : resource.type,
      title,
      properties: resource.properties ?? {},
      tags: resource.tags.map(tag => ({ label: tag.label })),
    };
  }

  for (const connection of connections) {
    const sourceId = resourceToId(connection.source);
    if (sourceId === undefined) {
      continue;
    }

    const isPlaceholder = connection.target.isPlaceholder();

    if (isPlaceholder && !includePlaceholders) {
      continue;
    }

    let targetId = resourceToId(connection.target);

    if (isPlaceholder) {
      // Use resourceToId result if available, otherwise fall back to raw path.
      targetId = targetId ?? connection.target.path;
      if (!(targetId in nodeInfo)) {
        nodeInfo[targetId] = {
          id: targetId,
          type: 'placeholder',
          title: targetId,
          properties: {},
          tags: [],
        };
      }
    } else if (targetId === undefined) {
      continue;
    }

    links.set(`${sourceId}->${targetId}`, { source: sourceId, target: targetId });
  }

  return { nodeInfo, links: Array.from(links.values()) };
}
