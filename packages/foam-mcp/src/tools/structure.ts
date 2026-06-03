import { z } from 'zod';
import { Foam, URI, outlineData, resolveNote } from '@foam/core';
import { parseUriInput, serializeOutlineResult } from '../serializers';
import type { ToolRegistrar } from '../server';

const json = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data) }],
});

export function registerStructureTools(
  register: ToolRegistrar,
  foam: Foam,
  rootUri: URI
) {
  register(
    'get_outline',
    {
      description: 'Return the heading structure (sections) of a resource.',
      inputSchema: {
        uri: z.string(),
      },
    },
    async args => {
      const uri = parseUriInput(args.uri, rootUri);
      const resource = resolveNote(foam.workspace, { uri });
      const outline = outlineData(foam.workspace, resource);
      return json(serializeOutlineResult(outline, rootUri));
    }
  );
}
