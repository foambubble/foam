import { z } from 'zod';
import {
  Foam,
  FoamError,
  QueryDescriptor,
  QueryStore,
  URI,
  executeQuery,
} from '@foam/core';
import { uriToOutputString } from '../serializers';
import type { ToolRegistrar } from '../server';

const json = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data) }],
});

export function registerQueryTools(
  register: ToolRegistrar,
  foam: Foam,
  queryStore: QueryStore,
  rootUri: URI
) {
  // ─── list_queries ──────────────────────────────────────────────────────────
  register(
    'list_queries',
    {
      description:
        'List all saved queries in this workspace (the YAML files under .foam/queries/).',
      inputSchema: {},
    },
    async () => {
      const loaded = await queryStore.loadAll();
      return json(
        loaded.map(item => ({
          id: item.query.id,
          name: item.query.name,
          description: item.query.description,
          matchCount: countMatches(item.query.descriptor, foam),
          errors: item.errors,
        }))
      );
    }
  );

  // ─── get_query ─────────────────────────────────────────────────────────────
  register(
    'get_query',
    {
      description:
        'Return the descriptor (filter, sort, limit, ...) and metadata for a saved query.',
      inputSchema: {
        id: z.string(),
      },
    },
    async args => {
      const loaded = await queryStore.load(queryStore.getFileUri(args.id));
      if (!loaded) {
        throw new FoamError(
          'resource_not_found',
          `Saved query "${args.id}" not found.`
        );
      }
      return json({
        id: loaded.query.id,
        name: loaded.query.name,
        description: loaded.query.description,
        descriptor: loaded.query.descriptor,
        errors: loaded.errors,
      });
    }
  );

  // ─── run_query ─────────────────────────────────────────────────────────────
  register(
    'run_query',
    {
      description:
        'Execute a query and return matching resources. Pass either `id` (run a saved query) or `descriptor` (run an ad-hoc query). Exactly one must be provided.',
      inputSchema: {
        id: z.string().optional(),
        descriptor: z
          .object({
            filter: z.unknown().optional(),
            sort: z.string().optional(),
            limit: z.number().int().positive().optional(),
            offset: z.number().int().nonnegative().optional(),
            select: z.array(z.unknown()).optional(),
            format: z.enum(['table', 'list', 'count']).optional(),
          })
          .optional(),
      },
    },
    async args => {
      if ((args.id && args.descriptor) || (!args.id && !args.descriptor)) {
        throw new FoamError(
          'invalid_input',
          'Provide exactly one of `id` (saved query) or `descriptor` (ad-hoc query).'
        );
      }

      let descriptor: QueryDescriptor;
      if (args.id) {
        const loaded = await queryStore.load(queryStore.getFileUri(args.id));
        if (!loaded) {
          throw new FoamError(
          'resource_not_found',
          `Saved query "${args.id}" not found.`
        );
        }
        descriptor = loaded.query.descriptor;
      } else {
        descriptor = args.descriptor as QueryDescriptor;
      }

      const { results, warnings } = executeQuery(
        descriptor,
        foam.workspace,
        foam.graph,
        { trusted: false }
      );

      return json({
        results: results.map(r => ({
          uri: uriToOutputString(r.uri, rootUri),
          ...projectionFields(r),
        })),
        warnings,
      });
    }
  );
}

function countMatches(descriptor: QueryDescriptor, foam: Foam): number {
  try {
    const { results } = executeQuery(descriptor, foam.workspace, foam.graph, {
      trusted: false,
    });
    return results.length;
  } catch {
    return 0;
  }
}

// Drop `uri` because we re-emit it separately as a workspace-relative path.
function projectionFields(view: { uri: URI } & Record<string, unknown>) {
  const { uri: _uri, ...rest } = view;
  return rest;
}
