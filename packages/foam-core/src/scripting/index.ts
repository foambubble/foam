/**
 * Functionality that executes user-supplied JavaScript, which depends on
 * Node's `vm` module for sandboxed execution: JS templates, daily-note
 * resolution and note creation through them, and JS query rendering.
 *
 * Kept out of the main `@foam/core` barrel so that non-Node consumers
 * (browsers, React Native) can bundle the default entry point without
 * shims. Import from `@foam/core/scripting` only in Node-based hosts
 * (VS Code extension host, CLI, MCP server).
 */

export { TemplateLoader } from '../templates/template-loader';
export { resolveDailyNote } from '../templates/daily-note-resolver';
export type { ResolveDailyNoteOptions } from '../templates/daily-note-resolver';
export { noteCreate } from '../commands/note-create';
export type { NoteCreateResult } from '../commands/note-create';
export { renderJsQuery } from '../query/js';
export type { RenderJsQueryOptions } from '../query/js';
