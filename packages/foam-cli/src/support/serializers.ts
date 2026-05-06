// JSON serializers — convert command return shapes (which carry URI objects)
// into wire-format JSON for CLI output. URI objects are flattened to their
// fsPath; a workspace-relative `path` field is added for display.

import {
  FoamWorkspace,
  uriToWorkspacePath,
  type LinkEntry,
  type LinksResult,
  type NoteDetail,
  type NoteItem,
  type NoteSummary,
  type OutlineResult,
  type PlaceholderItem,
  type SearchMatch,
} from '@foam/core';

interface NoteItemJson {
  id: string;
  uri: string;
  path: string;
  title: string;
  type: string;
  tags: string[];
}

interface NoteSummaryJson {
  id: string;
  uri: string;
  path: string;
  title: string;
}

interface LinkEntryJson {
  id: string;
  uri: string;
  path: string;
  title: string;
  label?: string;
}

export function serializeNoteItem(
  n: NoteItem,
  workspace: FoamWorkspace
): NoteItemJson {
  return {
    id: n.id,
    uri: n.uri.toFsPath(),
    path: uriToWorkspacePath(n.uri, workspace),
    title: n.title,
    type: n.type,
    tags: n.tags,
  };
}

export function serializeNoteSummary(
  n: NoteSummary,
  workspace: FoamWorkspace
): NoteSummaryJson {
  return {
    id: n.id,
    uri: n.uri.toFsPath(),
    path: uriToWorkspacePath(n.uri, workspace),
    title: n.title,
  };
}

export function serializeLinkEntry(
  e: LinkEntry,
  workspace: FoamWorkspace
): LinkEntryJson {
  return {
    id: e.id,
    uri: e.uri.toFsPath(),
    path: uriToWorkspacePath(e.uri, workspace),
    title: e.title,
    label: e.label,
  };
}

export function serializeLinksResult(
  r: LinksResult,
  workspace: FoamWorkspace
) {
  return {
    id: r.id,
    uri: r.uri.toFsPath(),
    path: uriToWorkspacePath(r.uri, workspace),
    outgoing: r.outgoing.map(e => serializeLinkEntry(e, workspace)),
    incoming: r.incoming.map(e => serializeLinkEntry(e, workspace)),
  };
}

export function serializePlaceholder(
  p: PlaceholderItem,
  workspace: FoamWorkspace
) {
  return {
    placeholder_id: p.placeholder_id,
    referenced_by: p.referenced_by.map(r => serializeNoteSummary(r, workspace)),
  };
}

export function serializeOutline(o: OutlineResult, workspace: FoamWorkspace) {
  return {
    id: o.id,
    uri: o.uri.toFsPath(),
    path: uriToWorkspacePath(o.uri, workspace),
    sections: o.sections,
  };
}

export function serializeNoteDetail(d: NoteDetail, workspace: FoamWorkspace) {
  return {
    id: d.id,
    uri: d.uri.toFsPath(),
    path: uriToWorkspacePath(d.uri, workspace),
    title: d.title,
    type: d.type,
    tags: d.tags,
    aliases: d.aliases,
    properties: d.properties,
    ...(d.links ? { links: d.links } : {}),
  };
}

export function serializeSearchMatch(
  m: SearchMatch,
  workspace: FoamWorkspace
) {
  return {
    id: m.id,
    uri: m.uri.toFsPath(),
    path: uriToWorkspacePath(m.uri, workspace),
    title: m.title,
    type: m.type,
    tags: m.tags,
    properties: m.properties,
    line: m.line,
    text: m.text,
    ...(m.context_before !== undefined
      ? { context_before: m.context_before }
      : {}),
    ...(m.context_after !== undefined
      ? { context_after: m.context_after }
      : {}),
  };
}
