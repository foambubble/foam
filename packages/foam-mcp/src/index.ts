export { FoamMcpServer } from './server';
export type { FoamMcpServerOptions } from './server';

// Re-export the transports consumers are likely to need so they don't have
// to take a direct dependency on @modelcontextprotocol/sdk (which would
// require keeping versions in lockstep with this package's pinned SDK).
export { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
export type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
export {
  parseUriInput,
  uriToOutputString,
  serializeNoteItem,
  serializeNoteSummary,
  serializeLinkEntry,
  serializePlaceholderItem,
  serializeNoteDetail,
  serializeOutlineResult,
  serializeSearchMatch,
  serializeTraversalResult,
} from './serializers';
export type {
  JsonNoteItem,
  JsonNoteSummary,
  JsonLinkEntry,
  JsonPlaceholderItem,
  JsonNoteDetail,
  JsonOutlineResult,
  JsonSearchMatch,
  JsonTraversalResult,
} from './serializers';
export { mapErrorToToolResult } from './errors';
