import { z } from 'zod';
import {
  Foam,
  FoamError,
  IDataStore,
  URI,
  addTagsToFrontmatter,
  removeTagsFromFrontmatter,
  listTags,
  renameTag,
  resolveNote,
  searchWorkspace,
} from '@foam/core';
import {
  parseUriInput,
  uriToOutputString,
  serializeNoteItem,
} from '../serializers';
import type { ToolRegistrar } from '../server';

const json = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data) }],
});

export function registerTagTools(
  register: ToolRegistrar,
  foam: Foam,
  dataStore: IDataStore,
  rootUri: URI,
  opts: { readOnly?: boolean } = {}
) {
  const { readOnly = false } = opts;
  // ─── list_tags ─────────────────────────────────────────────────────────────
  register(
    'list_tags',
    {
      description: 'List all tags with usage counts.',
      inputSchema: {
        prefix: z.string().optional(),
        limit: z.number().int().positive().optional(),
      },
    },
    async args => {
      const tags = listTags(foam.tags, {
        prefix: args.prefix,
        sort: 'count',
        limit: args.limit,
      });
      return json(tags);
    }
  );

  // ─── search_by_tag ─────────────────────────────────────────────────────────
  register(
    'search_by_tag',
    {
      description: 'Find resources tagged with the given tag.',
      inputSchema: {
        tag: z.string(),
        limit: z.number().int().positive().optional(),
      },
    },
    async args => {
      const cleanTag = args.tag.startsWith('#') ? args.tag.slice(1) : args.tag;
      const matches = searchWorkspace(foam.workspace, {
        tags: [cleanTag],
        limit: args.limit,
      });
      // Reuse NoteItem serialization shape (search match is a superset).
      return json(
        matches.map(m => ({
          id: m.id,
          uri: uriToOutputString(m.uri, rootUri),
          title: m.title,
          type: m.type,
          tags: m.tags,
        }))
      );
    }
  );

  if (readOnly) {
    return;
  }

  // ─── add_tags ──────────────────────────────────────────────────────────────
  register(
    'add_tags',
    {
      description:
        'Add tags to a note\'s frontmatter (deduplicating). Returns the resulting tag list.',
      inputSchema: {
        uri: z.string(),
        tags: z.array(z.string()).min(1),
      },
    },
    async args => {
      const uri = parseUriInput(args.uri, rootUri);
      const existing = await dataStore.read(uri);
      if (existing === null) {
        throw new FoamError(
          'resource_not_found',
          `Resource not found: ${args.uri}`,
          { uri: args.uri }
        );
      }
      const { content, tags } = addTagsToFrontmatter(existing, args.tags);
      await dataStore.write(uri, content);
      return json({ uri: uriToOutputString(uri, rootUri), tags });
    }
  );

  // ─── remove_tags ───────────────────────────────────────────────────────────
  register(
    'remove_tags',
    {
      description: 'Remove tags from a note\'s frontmatter.',
      inputSchema: {
        uri: z.string(),
        tags: z.array(z.string()).min(1),
      },
    },
    async args => {
      const uri = parseUriInput(args.uri, rootUri);
      const existing = await dataStore.read(uri);
      if (existing === null) {
        throw new FoamError(
          'resource_not_found',
          `Resource not found: ${args.uri}`,
          { uri: args.uri }
        );
      }
      const { content, tags } = removeTagsFromFrontmatter(existing, args.tags);
      await dataStore.write(uri, content);
      return json({ uri: uriToOutputString(uri, rootUri), tags });
    }
  );

  // ─── rename_tag ────────────────────────────────────────────────────────────
  register(
    'rename_tag',
    {
      description:
        'Rename a tag across the entire workspace. Pass `force: true` to merge into an existing target tag.',
      inputSchema: {
        old_tag: z.string(),
        new_tag: z.string(),
        force: z.boolean().optional(),
      },
    },
    async args => {
      const result = await renameTag(
        foam.tags,
        dataStore,
        args.old_tag,
        args.new_tag,
        args.force === true
      );
      return json({
        old_tag: result.old_tag,
        new_tag: result.new_tag,
        updated_resources: result.updated_notes,
      });
    }
  );
}
