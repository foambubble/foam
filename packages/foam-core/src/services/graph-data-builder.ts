import type { Resource } from '../model/note';
import type { Connection } from '../model/graph';
import type { URI } from '../model/uri';
import { isWithinPath } from '../utils/path';

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
   * Optional transform for the frontmatter properties stored on each node.
   * Defaults to passing the resource's properties through unchanged (the
   * local graph view groups/colors nodes by arbitrary frontmatter keys).
   *
   * Anything that PUBLISHES the graph data must restrict this to an
   * allowlist: raw frontmatter can contain private fields that must not
   * ship in published graph JSON.
   */
  transformProperties?: (
    properties: Record<string, unknown>,
    resource: Resource
  ) => GraphNodeData['properties'];
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
  /**
   * Workspace roots whose folders become `folder` nodes. Each folder holding
   * an included resource, directly or in a subfolder, links to its
   * subfolders and to the resources directly inside it. A root gets no node
   * of its own, and placeholders belong to no folder.
   *
   * A folder's id is `folder:` followed by its path, so `resourceToId` must
   * not return ids of that form. Defaults to no roots, and so no folders.
   */
  folderRoots?: URI[];
}

export function buildGraphData(
  resources: Resource[],
  connections: Connection[],
  options: GraphBuilderOptions
): BuiltGraphData {
  const {
    resourceToId,
    transformProperties,
    includePlaceholders = false,
    folderRoots = [],
  } = options;
  const nodeInfo: Record<string, GraphNodeData> = {};
  const links = new Map<string, { source: string; target: string }>();

  for (const resource of resources) {
    const id = resourceToId(resource.uri);
    if (id === undefined) {
      continue;
    }
    const title =
      resource.type === 'note' ? resource.title : resource.uri.getBasename();
    nodeInfo[id] = {
      id,
      type:
        resource.type === 'note'
          ? resource.properties.type ?? 'note'
          : resource.type,
      title,
      properties: transformProperties
        ? transformProperties(resource.properties ?? {}, resource)
        : resource.properties ?? {},
      tags: resource.tags.map(tag => ({ label: tag.label })),
    };

    const root = folderRoots.find(r => isWithinPath(resource.uri, r));
    let childId = id;
    let folder = resource.uri.getDirectory();
    // compared by length: drive letters may differ in case from the root's
    while (root && folder.path.length > root.path.length) {
      const folderId = `folder:${folder.path}`;
      links.set(`${folderId}->${childId}`, {
        source: folderId,
        target: childId,
      });
      if (folderId in nodeInfo) {
        break;
      }
      nodeInfo[folderId] = {
        id: folderId,
        type: 'folder',
        title: folder.getBasename(),
        properties: {},
        tags: [],
      };
      childId = folderId;
      folder = folder.getDirectory();
    }
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
