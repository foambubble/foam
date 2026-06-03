import { z } from 'zod';
import { Foam, URI, searchWorkspace } from '@foam/core';
import { serializeSearchMatch } from '../serializers';
import type { ToolRegistrar } from '../server';

const json = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data) }],
});

export function registerSearchTools(
  register: ToolRegistrar,
  foam: Foam,
  rootUri: URI
) {
  register(
    'search_resources',
    {
      description: 'Search resources by title, alias, tag, or property.',
      inputSchema: {
        query: z.string(),
        limit: z.number().int().positive().optional(),
      },
    },
    async args => {
      const matches = searchWorkspace(foam.workspace, {
        query: args.query,
        limit: args.limit,
      });
      return json(matches.map(m => serializeSearchMatch(m, rootUri)));
    }
  );

  register(
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
    async args => {
      const matches = searchWorkspace(foam.workspace, {
        properties: [{ key: args.property, value: args.value }],
        limit: args.limit,
      });
      return json(matches.map(m => serializeSearchMatch(m, rootUri)));
    }
  );
}
