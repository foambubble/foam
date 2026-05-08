import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Foam, URI, outlineData, resolveNote } from '@foam/core';
import { parseUriInput, serializeOutlineResult } from '../serializers';
import { withToolErrorHandling } from '../errors';

const json = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data) }],
});

export function registerStructureTools(
  server: McpServer,
  foam: Foam,
  rootUri: URI
) {
  server.registerTool(
    'get_outline',
    {
      description: 'Return the heading structure (sections) of a resource.',
      inputSchema: {
        uri: z.string(),
      },
    },
    withToolErrorHandling(async args => {
      const uri = parseUriInput(args.uri, rootUri);
      const resource = resolveNote(foam.workspace, { uri });
      const outline = outlineData(foam.workspace, resource);
      return json(serializeOutlineResult(outline, rootUri));
    })
  );
}
