import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  Foam,
  URI,
  linksData,
  listOrphans,
  listDeadends,
  listPlaceholders,
  resolveNote,
  traverseGraph,
  listNotes,
} from '@foam/core';
import {
  parseUriInput,
  serializeLinkEntry,
  serializeNoteSummary,
  serializePlaceholderItem,
  serializeTraversalResult,
  uriToOutputString,
} from '../serializers';
import { withToolErrorHandling } from '../errors';

const json = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data) }],
});

const MAX_TRAVERSAL_DEPTH = 5;

export function registerGraphTools(
  server: McpServer,
  foam: Foam,
  rootUri: URI,
  opts: { readOnly?: boolean } = {}
) {
  const { readOnly = false } = opts;
  // ─── get_connections ───────────────────────────────────────────────────────
  server.registerTool(
    'get_connections',
    {
      description:
        'Get outgoing links and/or incoming backlinks for a resource.',
      inputSchema: {
        uri: z.string(),
        direction: z.enum(['links', 'backlinks', 'both']).optional(),
      },
    },
    withToolErrorHandling(async args => {
      const uri = parseUriInput(args.uri, rootUri);
      const resource = resolveNote(foam.workspace, { uri });
      const data = linksData(foam.workspace, foam.graph, resource);
      const direction = args.direction ?? 'both';
      return json({
        links:
          direction === 'backlinks'
            ? []
            : data.outgoing.map(l => serializeLinkEntry(l, rootUri)),
        backlinks:
          direction === 'links'
            ? []
            : data.incoming.map(l => serializeLinkEntry(l, rootUri)),
      });
    })
  );

  // ─── get_orphans ───────────────────────────────────────────────────────────
  server.registerTool(
    'get_orphans',
    {
      description:
        'List notes with no incoming or outgoing links. Attachments and images are excluded by default.',
      inputSchema: {
        exclude_types: z.array(z.string()).optional(),
      },
    },
    withToolErrorHandling(async args => {
      const items = listOrphans(foam.workspace, foam.graph, {
        excludeTypes: args.exclude_types,
      });
      return json(items.map(i => serializeNoteSummary(i, rootUri)));
    })
  );

  // ─── get_deadends ──────────────────────────────────────────────────────────
  server.registerTool(
    'get_deadends',
    {
      description: 'List notes with incoming links but no outgoing links.',
      inputSchema: {
        exclude_types: z.array(z.string()).optional(),
      },
    },
    withToolErrorHandling(async args => {
      const items = listDeadends(foam.workspace, foam.graph, {
        excludeTypes: args.exclude_types,
      });
      return json(items.map(i => serializeNoteSummary(i, rootUri)));
    })
  );

  // ─── get_placeholders ──────────────────────────────────────────────────────
  server.registerTool(
    'get_placeholders',
    {
      description:
        'List placeholder URIs (broken wikilinks pointing at nonexistent notes) and the notes that reference each one.',
      inputSchema: {},
    },
    withToolErrorHandling(async () => {
      const items = listPlaceholders(foam.workspace, foam.graph);
      return json(items.map(i => serializePlaceholderItem(i, rootUri)));
    })
  );

  // ─── traverse_graph ────────────────────────────────────────────────────────
  server.registerTool(
    'traverse_graph',
    {
      description:
        'BFS over the link graph from a starting note. Returns visited nodes (with hop distance) and the edges traversed.',
      inputSchema: {
        uri: z.string(),
        depth: z.number().int().min(0).max(MAX_TRAVERSAL_DEPTH),
        direction: z.enum(['links', 'backlinks', 'both']),
      },
    },
    withToolErrorHandling(async args => {
      const start = parseUriInput(args.uri, rootUri);
      const result = traverseGraph(
        foam.workspace,
        foam.graph,
        start,
        args.depth,
        args.direction
      );
      return json(serializeTraversalResult(result, rootUri));
    })
  );

  // ─── get_graph_summary ─────────────────────────────────────────────────────
  server.registerTool(
    'get_graph_summary',
    {
      description:
        'Workspace-level metrics: counts, top connected notes, top tags.',
      inputSchema: {},
    },
    withToolErrorHandling(async () => {
      const allResources = foam.workspace.list();
      const noteCount = allResources.filter(r => r.type === 'note').length;
      const attachmentCount = allResources.length - noteCount;
      const allConnections = foam.graph.getAllConnections();
      const orphans = listOrphans(foam.workspace, foam.graph);
      const placeholders = listPlaceholders(foam.workspace, foam.graph);

      const linkCounts = new Map<string, number>();
      for (const c of allConnections) {
        linkCounts.set(c.source.path, (linkCounts.get(c.source.path) ?? 0) + 1);
      }
      const mostConnected = Array.from(linkCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([uriPath, count]) => {
          const resource = foam.workspace.list().find(r => r.uri.path === uriPath);
          return resource
            ? {
                uri: uriToOutputString(resource.uri, rootUri),
                title: resource.title,
                link_count: count,
              }
            : null;
        })
        .filter(x => x !== null);

      const mostUsedTags = Array.from(foam.tags.tags.entries())
        .map(([tag, locations]) => ({ tag, count: locations.length }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return json({
        note_count: noteCount,
        attachment_count: attachmentCount,
        connection_count: allConnections.length,
        orphan_count: orphans.length,
        placeholder_count: placeholders.length,
        tag_count: foam.tags.tags.size,
        most_connected: mostConnected,
        most_used_tags: mostUsedTags,
      });
    })
  );

  // ─── get_workspace_info ────────────────────────────────────────────────────
  server.registerTool(
    'get_workspace_info',
    {
      description: 'High-level counts for the workspace.',
      inputSchema: {},
    },
    withToolErrorHandling(async () => {
      const all = foam.workspace.list();
      const noteCount = all.filter(r => r.type === 'note').length;
      return json({
        root_dir: rootUri.path,
        note_count: noteCount,
        attachment_count: all.length - noteCount,
        tag_count: foam.tags.tags.size,
        orphan_count: listOrphans(foam.workspace, foam.graph).length,
        placeholder_count: foam.graph.placeholders.size,
        connection_count: foam.graph.getAllConnections().length,
        // total resource count (notes + attachments)
        resource_count: listNotes(foam.workspace, {}).length,
        read_only: readOnly,
      });
    })
  );
}
