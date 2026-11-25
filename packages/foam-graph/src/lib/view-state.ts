import type { GraphStyle, GraphViewState, GroupRule } from '../protocol';
import type {
  Forces,
  GraphScope,
  Labels,
  LinkAnimation,
  Selection,
} from './types';
import { DEFAULT_LABEL_MAX_LENGTH } from './labels';

/**
 * Built-in defaults for the interactive display state — the base layer a
 * view restore starts from, under the declared style and the saved state.
 */
export const defaultViewState = () => ({
  showControlPanel: true,
  showNodesOfType: {
    placeholder: true,
    image: false,
    attachment: false,
    note: true,
    tag: true,
    folder: false,
  } as Record<string, boolean>,
  groups: [] as GroupRule[],
  localStylePatch: {} as GraphStyle,
  labels: { fade: 0 } as Labels,
  forces: {
    collide: 1,
    repel: 15,
    link: 25,
    velocityDecay: 0.4,
  } as Forces,
  selection: {
    neighborDepth: 1,
    centerOnSelect: true,
    zoomOnSelect: true,
  } as Selection,
  graphScope: 'full' as GraphScope,
  nodeFontSizeMultiplier: 1,
  nodeSizeMultiplier: 1,
  linkWidthMultiplier: 2,
  animateLinks: 'forward' as LinkAnimation,
  labelMaxLength: DEFAULT_LABEL_MAX_LENGTH,
});

export type FullViewState = ReturnType<typeof defaultViewState>;

/**
 * The display state a view shows: the built-in defaults, then the declared
 * style (base settings + view config), then the saved state. Type filters
 * come out as layered, before the graph's own types are filled in.
 */
export function layerViewState(
  declared: GraphStyle | null,
  saved: GraphViewState
): FullViewState {
  const state = defaultViewState();

  if (declared?.groups) state.groups = declared.groups;
  if (declared?.showNodesOfType) {
    state.showNodesOfType = {
      ...state.showNodesOfType,
      ...declared.showNodesOfType,
    };
  }

  if (saved.showControlPanel !== undefined) {
    state.showControlPanel = saved.showControlPanel;
  }
  if (saved.showNodesOfType) {
    state.showNodesOfType = {
      ...state.showNodesOfType,
      ...saved.showNodesOfType,
    };
  }
  if (saved.groups) state.groups = saved.groups;
  if (saved.localStylePatch) state.localStylePatch = saved.localStylePatch;
  if (saved.labels !== undefined) state.labels = saved.labels;
  if (saved.forces) state.forces = saved.forces;
  if (saved.selection) state.selection = saved.selection;
  if (saved.graphScope !== undefined) state.graphScope = saved.graphScope;
  if (saved.nodeFontSizeMultiplier !== undefined) {
    state.nodeFontSizeMultiplier = saved.nodeFontSizeMultiplier;
  }
  if (saved.nodeSizeMultiplier !== undefined) {
    state.nodeSizeMultiplier = saved.nodeSizeMultiplier;
  }
  if (saved.linkWidthMultiplier !== undefined) {
    state.linkWidthMultiplier = saved.linkWidthMultiplier;
  }
  if (saved.animateLinks !== undefined) {
    state.animateLinks = saved.animateLinks;
  }
  if (saved.labelMaxLength !== undefined) {
    state.labelMaxLength = saved.labelMaxLength;
  }

  return state;
}

/**
 * Structural equality for view state, which is plain JSON-like data: key
 * order is ignored, and a key set to undefined matches a missing one.
 */
export function isSameViewSetting(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (
    typeof a !== 'object' ||
    typeof b !== 'object' ||
    a === null ||
    b === null ||
    Array.isArray(a) !== Array.isArray(b)
  ) {
    return false;
  }
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if (!isSameViewSetting(left[key], right[key])) return false;
  }
  return true;
}
