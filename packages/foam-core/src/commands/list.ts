import { FoamGraph } from '../model/graph';
import { FoamTags } from '../model/tags';
import { FoamWorkspace } from '../model/workspace';
import { URI } from '../model/uri';

// ─── Return types ─────────────────────────────────────────────────────────────

export interface NoteItem {
  id: string;
  uri: URI;
  title: string;
  type: string;
  tags: string[];
}

export interface NoteSummary {
  id: string;
  uri: URI;
  title: string;
}

export interface TagItem {
  tag: string;
  count: number;
}

export interface PlaceholderItem {
  placeholder_id: string;
  uri: URI;
  referenced_by: NoteSummary[];
}

// ─── Domain functions ─────────────────────────────────────────────────────────

export function listNotes(
  workspace: FoamWorkspace,
  opts: { type?: string; tags?: string[]; limit?: number }
): NoteItem[] {
  let resources = workspace.list();

  if (opts.type) {
    resources = resources.filter(r => r.type === opts.type);
  }

  if (opts.tags && opts.tags.length > 0) {
    resources = resources.filter(r =>
      opts.tags!.every(tag => r.tags.some(t => t.label === tag))
    );
  }

  if (opts.limit !== undefined) {
    resources = resources.slice(0, opts.limit);
  }

  return resources.map(r => ({
    id: workspace.getIdentifier(r.uri),
    uri: r.uri,
    title: r.title,
    type: r.type,
    tags: r.tags.map(t => t.label),
  }));
}

export function listTags(
  foamTags: FoamTags,
  opts: { prefix?: string; sort?: 'count' | 'name'; limit?: number }
): TagItem[] {
  let entries = Array.from(foamTags.tags.entries()).map(([tag, locations]) => ({
    tag,
    count: locations.length,
  }));

  if (opts.prefix) {
    entries = entries.filter(e => e.tag.startsWith(opts.prefix!));
  }

  entries.sort((a, b) =>
    opts.sort === 'count' ? b.count - a.count : a.tag.localeCompare(b.tag)
  );

  if (opts.limit !== undefined) {
    entries = entries.slice(0, opts.limit);
  }

  return entries;
}

export function listOrphans(
  workspace: FoamWorkspace,
  graph: FoamGraph
): NoteSummary[] {
  return workspace
    .list()
    .filter(r => {
      if (r.type !== 'note') return false;
      const outgoing = graph.getLinks(r.uri);
      const incoming = graph.getBacklinks(r.uri);
      return outgoing.length === 0 && incoming.length === 0;
    })
    .map(r => ({
      id: workspace.getIdentifier(r.uri),
      uri: r.uri,
      title: r.title,
    }));
}

export function listDeadends(
  workspace: FoamWorkspace,
  graph: FoamGraph
): NoteSummary[] {
  return workspace
    .list()
    .filter(r => {
      if (r.type !== 'note') return false;
      const outgoing = graph.getLinks(r.uri);
      return outgoing.length === 0;
    })
    .map(r => ({
      id: workspace.getIdentifier(r.uri),
      uri: r.uri,
      title: r.title,
    }));
}

export function listPlaceholders(
  workspace: FoamWorkspace,
  graph: FoamGraph
): PlaceholderItem[] {
  return Array.from(graph.placeholders.values()).map(placeholderUri => {
    const backlinks = graph.getBacklinks(placeholderUri);
    return {
      placeholder_id: placeholderUri.path.split('/').pop()!,
      uri: placeholderUri,
      referenced_by: backlinks.map(conn => {
        const src = workspace.find(conn.source);
        return {
          id: workspace.getIdentifier(conn.source),
          uri: conn.source,
          title: src?.title ?? '',
        };
      }),
    };
  });
}
