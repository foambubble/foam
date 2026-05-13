import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  Foam,
  FoamError,
  IDataStore,
  URI,
  listNotes,
  noteShowData,
  noteCreate,
  noteDelete,
  noteMove,
  resolveNote,
  mergeFrontmatter,
} from '@foam/core';
import {
  parseUriInput,
  uriToOutputString,
  serializeNoteItem,
  serializeNoteDetail,
} from '../serializers';
import { withToolErrorHandling } from '../errors';

const json = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data) }],
});

export function registerResourceTools(
  server: McpServer,
  foam: Foam,
  dataStore: IDataStore,
  rootUri: URI,
  opts: { readOnly?: boolean } = {}
) {
  const { readOnly = false } = opts;
  // ─── list_resources ────────────────────────────────────────────────────────
  server.registerTool(
    'list_resources',
    {
      description:
        'List notes in the workspace, optionally filtered by type and/or tag.',
      inputSchema: {
        type: z.string().optional(),
        tag: z.string().optional(),
        limit: z.number().int().positive().optional(),
      },
    },
    withToolErrorHandling(async args => {
      const items = listNotes(foam.workspace, {
        type: args.type,
        tags: args.tag ? [args.tag] : undefined,
        limit: args.limit,
      });
      return json(items.map(i => serializeNoteItem(i, rootUri)));
    })
  );

  // ─── get_resource ──────────────────────────────────────────────────────────
  server.registerTool(
    'get_resource',
    {
      description:
        'Get full metadata for a single resource, including outgoing/incoming link identifiers. Provide either `uri` or `identifier`.',
      inputSchema: {
        uri: z.string().optional(),
        identifier: z.string().optional(),
      },
    },
    withToolErrorHandling(async args => {
      if (!args.uri && !args.identifier) {
        throw new FoamError(
          'invalid_input',
          'Provide either `uri` or `identifier`.'
        );
      }
      const ref = args.uri
        ? { uri: parseUriInput(args.uri, rootUri) }
        : { identifier: args.identifier! };
      const resource = resolveNote(foam.workspace, ref);
      const detail = noteShowData(foam.workspace, foam.graph, resource, {
        includeLinks: true,
      });
      return json(serializeNoteDetail(detail, rootUri));
    })
  );

  // ─── read_resource ─────────────────────────────────────────────────────────
  server.registerTool(
    'read_resource',
    {
      description: 'Read the raw markdown content of a resource.',
      inputSchema: {
        uri: z.string(),
      },
    },
    withToolErrorHandling(async args => {
      const uri = parseUriInput(args.uri, rootUri);
      const content = await dataStore.read(uri);
      if (content === null) {
        throw new FoamError(
          'resource_not_found',
          `Resource not found: ${args.uri}`,
          { uri: args.uri }
        );
      }
      return json({ uri: uriToOutputString(uri, rootUri), content });
    })
  );

  if (readOnly) {
    return;
  }

  // ─── create_resource ───────────────────────────────────────────────────────
  server.registerTool(
    'create_resource',
    {
      description:
        'Create a new note. Errors if the destination already exists.',
      inputSchema: {
        title: z.string().optional(),
        dir: z.string().optional(),
        properties: z.record(z.string(), z.string()).optional(),
      },
    },
    withToolErrorHandling(async args => {
      // MCP is agent-driven; never grant JS-template execution rights.
      const result = await noteCreate(
        foam,
        dataStore,
        {
          title: args.title,
          dir: args.dir,
          properties: args.properties,
        },
        false
      );
      const resource = foam.workspace.find(result.uri);
      return json({
        uri: uriToOutputString(result.uri, rootUri),
        id: result.id,
        title: resource?.title ?? args.title ?? '',
      });
    })
  );

  // ─── update_resource ───────────────────────────────────────────────────────
  server.registerTool(
    'update_resource',
    {
      description:
        'Update a note. If `content` is given, the file is overwritten. If only `properties` is given, frontmatter is merged (or replaced when `merge_properties` is false).',
      inputSchema: {
        uri: z.string(),
        content: z.string().optional(),
        properties: z.record(z.string(), z.unknown()).optional(),
        merge_properties: z.boolean().optional(),
      },
    },
    withToolErrorHandling(async args => {
      const uri = parseUriInput(args.uri, rootUri);
      if (args.content === undefined && args.properties === undefined) {
        throw new FoamError(
          'invalid_input',
          'Provide `content` and/or `properties`.'
        );
      }
      let nextContent: string;
      if (args.content !== undefined && args.properties === undefined) {
        nextContent = args.content;
      } else {
        const existing = (await dataStore.read(uri)) ?? '';
        const base =
          args.content !== undefined ? args.content : existing;
        nextContent = args.properties
          ? mergeFrontmatter(
              base,
              args.properties,
              args.merge_properties === false ? 'replace' : 'merge'
            )
          : base;
      }
      await dataStore.write(uri, nextContent);
      return json({ uri: uriToOutputString(uri, rootUri) });
    })
  );

  // ─── delete_resource ───────────────────────────────────────────────────────
  server.registerTool(
    'delete_resource',
    {
      description:
        'Delete a note. Set `confirm: true` to proceed. By default the note is moved to .foam/trash; pass `permanent: true` to hard-delete.',
      inputSchema: {
        uri: z.string(),
        confirm: z.boolean().optional(),
        permanent: z.boolean().optional(),
      },
    },
    withToolErrorHandling(async args => {
      if (args.confirm !== true) {
        throw new FoamError(
          'invalid_input',
          'Pass `confirm: true` to delete the resource.'
        );
      }
      const uri = parseUriInput(args.uri, rootUri);
      const resource = resolveNote(foam.workspace, { uri });
      const result = await noteDelete(foam.workspace, dataStore, resource, {
        permanent: args.permanent === true,
      });
      return json({
        deleted: true,
        trashed: result.trashed,
        location: uriToOutputString(result.uri, rootUri),
      });
    })
  );

  // ─── move_resource ─────────────────────────────────────────────────────────
  server.registerTool(
    'move_resource',
    {
      description:
        'Move/rename a note. Updates inbound wikilinks across the workspace.',
      inputSchema: {
        uri: z.string(),
        new_path: z.string(),
      },
    },
    withToolErrorHandling(async args => {
      const oldUri = parseUriInput(args.uri, rootUri);
      const newUri = parseUriInput(args.new_path, rootUri);
      const resource = resolveNote(foam.workspace, { uri: oldUri });
      const result = await noteMove(
        foam.workspace,
        foam.graph,
        dataStore,
        resource,
        newUri
      );
      return json({
        old_uri: uriToOutputString(result.old_uri, rootUri),
        new_uri: uriToOutputString(result.new_uri, rootUri),
        updated_links: result.updated_links,
      });
    })
  );
}
