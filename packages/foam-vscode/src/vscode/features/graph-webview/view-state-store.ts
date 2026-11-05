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
  await memento.update(VIEW_STATE_KEY, {
    ...all,
    [viewName]: { ...all[viewName], ...state },
  });
}
