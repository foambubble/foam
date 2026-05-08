import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Foam, URI, searchWorkspace } from '@foam/core';
import { serializeSearchMatch } from '../serializers';
import { withToolErrorHandling } from '../errors';

const json = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data) }],
});

export function registerSearchTools(
  server: McpServer,
  foam: Foam,
  rootUri: URI
) {
  server.registerTool(
    'search_resources',
    {
      description: 'Search resources by title, alias, tag, or property.',
      inputSchema: {
        query: z.string(),
        limit: z.number().int().positive().optional(),
      },
    },
    withToolErrorHandling(async args => {
      const matches = searchWorkspace(foam.workspace, {
        query: args.query,
        limit: args.limit,
      });
      return json(matches.map(m => serializeSearchMatch(m, rootUri)));
    })
  );

  server.registerTool(
    'search_by_property',
    {
      description:
        'Find resources by frontmatter property. Omit `value` to match any value.',
      inputSchema: {
        property: z.string(),
        value: z.string().optional(),
        limit: z.number().int().positive().optional(),
      },
    },
    withToolErrorHandling(async args => {
      const matches = searchWorkspace(foam.workspace, {
        properties: [{ key: args.property, value: args.value }],
        limit: args.limit,
      });
      return json(matches.map(m => serializeSearchMatch(m, rootUri)));
    })
  );
}
