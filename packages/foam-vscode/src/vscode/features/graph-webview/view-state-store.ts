import { Memento } from 'vscode';
import type { GraphViewState } from '@foam/graph-view/protocol' with { 'resolution-mode': 'import' };

export const VIEW_STATE_KEY = 'foam.graph.viewState';

/**
 * One bucket per view name. Buckets and fields are carried as-is so state
 * written by a newer version survives a save from this one.
 */
type StoredViewStates = Record<string, Record<string, unknown>>;

export function getViewState(
  memento: Memento,
  viewName: string
): GraphViewState | undefined {
  const all = memento.get<StoredViewStates>(VIEW_STATE_KEY, {});
  return all[viewName] as GraphViewState | undefined;
}

export async function saveViewState(
  memento: Memento,
  viewName: string,
  state: GraphViewState
): Promise<void> {
  const all = memento.get<StoredViewStates>(VIEW_STATE_KEY, {});
  const existing = all[viewName] ?? {};
  const merged: Record<string, unknown> = { ...existing, ...state };
  // showNodesOfType is merged key-wise: the webview drops filter entries
  // for types currently absent from the graph, and a plain overwrite
  // would turn that into permanent loss of a saved preference once the
  // type reappears
  if (existing.showNodesOfType || state.showNodesOfType) {
    merged.showNodesOfType = {
      ...(existing.showNodesOfType as Record<string, boolean> | undefined),
      ...state.showNodesOfType,
    };
  }
  await memento.update(VIEW_STATE_KEY, {
    ...all,
    [viewName]: merged,
  });
}
