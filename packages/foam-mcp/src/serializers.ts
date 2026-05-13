import { URI, relativeTo } from '@foam/core';
import type {
  NoteItem,
  NoteSummary,
  LinkEntry,
  PlaceholderItem,
  NoteDetail,
  OutlineResult,
  SearchMatch,
  TraversalResult,
} from '@foam/core';

// ─── URI conversion at the wire boundary ─────────────────────────────────────

/**
 * Converts a wire-format URI string into a URI object.
 * Accepts:
 *   - `file://` URIs (parsed verbatim)
 *   - absolute filesystem paths (`/foo/bar.md`)
 *   - workspace-relative paths (`notes/foo.md`) — resolved against `rootUri`
 */
export function parseUriInput(input: string, rootUri: URI): URI {
  if (input.startsWith('file://')) return URI.parse(input, 'file');
  if (input.startsWith('/')) return URI.file(input);
  return rootUri.joinPath(input);
}

/**
 * Converts a URI to its wire-format string.
 *
 * - Placeholder URIs (broken wikilink targets) become `placeholder:<id>` —
 *   they have no real filesystem location, so trying to make them
 *   workspace-relative produces nonsense like `../../../<cwd>/<id>`.
 * - File URIs become a workspace-relative POSIX path when under `rootUri`,
 *   otherwise an absolute path.
 */
export function uriToOutputString(uri: URI, rootUri: URI): string {
  if (uri.scheme === 'placeholder') {
    return `placeholder:${uri.path}`;
  }
  return relativeTo(uri.path, rootUri.path);
}

// ─── JSON shapes ─────────────────────────────────────────────────────────────

export interface JsonNoteItem {
  id: string;
  uri: string;
  title: string;
  type: string;
  tags: string[];
}

export interface JsonNoteSummary {
  id: string;
  uri: string;
  title: string;
}

export interface JsonLinkEntry {
  id: string;
  uri: string;
  title: string;
  label?: string;
}

export interface JsonPlaceholderItem {
  placeholder_id: string;
  uri: string;
  referenced_by: JsonNoteSummary[];
}

export interface JsonNoteDetail {
  id: string;
  uri: string;
  title: string;
  type: string;
  tags: string[];
  aliases: string[];
  properties: Record<string, unknown>;
  links?: { outgoing: string[]; incoming: string[] };
}

export interface JsonOutlineResult {
  id: string;
  uri: string;
  sections: Array<{
    label: string;
    level: number;
    range: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
  }>;
}

export interface JsonSearchMatch {
  id: string;
  uri: string;
  title: string;
  type: string;
  tags: string[];
  properties: Record<string, unknown>;
  line: number;
  text: string;
  context_before?: string[];
  context_after?: string[];
}

export interface JsonTraversalResult {
  nodes: Array<{ uri: string; title: string; type: string; distance: number }>;
  edges: Array<{ source: string; target: string; label?: string }>;
}

// ─── Serializers ─────────────────────────────────────────────────────────────

export function serializeNoteItem(item: NoteItem, rootUri: URI): JsonNoteItem {
  return { ...item, uri: uriToOutputString(item.uri, rootUri) };
}

export function serializeNoteSummary(
  item: NoteSummary,
  rootUri: URI
): JsonNoteSummary {
  return { ...item, uri: uriToOutputString(item.uri, rootUri) };
}

export function serializeLinkEntry(
  entry: LinkEntry,
  rootUri: URI
): JsonLinkEntry {
  return { ...entry, uri: uriToOutputString(entry.uri, rootUri) };
}

export function serializePlaceholderItem(
  item: PlaceholderItem,
  rootUri: URI
): JsonPlaceholderItem {
  return {
    placeholder_id: item.placeholder_id,
    uri: uriToOutputString(item.uri, rootUri),
    referenced_by: item.referenced_by.map(s =>
      serializeNoteSummary(s, rootUri)
    ),
  };
}

export function serializeNoteDetail(
  detail: NoteDetail,
  rootUri: URI
): JsonNoteDetail {
  return { ...detail, uri: uriToOutputString(detail.uri, rootUri) };
}

export function serializeOutlineResult(
  outline: OutlineResult,
  rootUri: URI
): JsonOutlineResult {
  return {
    id: outline.id,
    uri: uriToOutputString(outline.uri, rootUri),
    sections: outline.sections,
  };
}

export function serializeSearchMatch(
  match: SearchMatch,
  rootUri: URI
): JsonSearchMatch {
  return { ...match, uri: uriToOutputString(match.uri, rootUri) };
}

export function serializeTraversalResult(
  result: TraversalResult,
  rootUri: URI
): JsonTraversalResult {
  return {
    nodes: result.nodes.map(n => ({
      uri: uriToOutputString(n.uri, rootUri),
      title: n.title,
      type: n.type,
      distance: n.distance,
    })),
    edges: result.edges.map(e => ({
      source: uriToOutputString(e.source, rootUri),
      target: uriToOutputString(e.target, rootUri),
      label: e.label,
    })),
  };
}
