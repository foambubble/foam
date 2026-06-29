import { FoamGraph } from '../model/graph';
import { Resource } from '../model/note';
import { URI } from '../model/uri';
import { FoamWorkspace } from '../model/workspace';
import { ExportSelector } from './types';

/**
 * Default selector: every note in the workspace, in iteration order.
 *
 * Note that `contentRoot` (set on `ExportConfig`) further scopes whichever
 * selector is in use — `selectAll` produces every note, and the pipeline
 * then drops anything outside the content root. To bypass that scoping,
 * write a selector that filters explicitly.
 */
export const selectAll = (): ExportSelector => {
  return (workspace: FoamWorkspace, _graph: FoamGraph): Resource[] =>
    workspace.list().filter(resource => resource.type === 'note');
};

/**
 * Selector that keeps every note for which `predicate` returns true,
 * preserving workspace iteration order. The convenience case for
 * "filter notes by some boolean" — the workspace.list boilerplate stays
 * out of the call site. For ordered or hand-picked sets, use `selectByUris`.
 */
export const selectWhere = (
  predicate: (resource: Resource) => boolean
): ExportSelector => {
  return (workspace: FoamWorkspace, _graph: FoamGraph): Resource[] =>
    workspace
      .list()
      .filter(resource => resource.type === 'note' && predicate(resource));
};

/**
 * Selector that picks specific notes in the order their URIs are given.
 *
 * This is the natural target for stateful selection upstream of the
 * pipeline: BFS traversal results, foam-query results, or the URIs the
 * user picked in a quick-pick UI. Order is preserved — first URI in the
 * array becomes the first note in the export.
 *
 * URIs that don't resolve to a workspace note are silently dropped, so the
 * caller can pass raw BFS results without pre-filtering for placeholders.
 */
export const selectByUris = (uris: readonly URI[]): ExportSelector => {
  return (workspace: FoamWorkspace, _graph: FoamGraph): Resource[] => {
    const selected: Resource[] = [];
    const seen = new Set<string>();
    for (const uri of uris) {
      if (seen.has(uri.path)) continue;
      seen.add(uri.path);
      const resource = workspace.find(uri);
      if (resource && resource.type === 'note') {
        selected.push(resource);
      }
    }
    return selected;
  };
};
