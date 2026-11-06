import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHostBridge, VIEW_STATE_DEBOUNCE_MS } from './host-bridge';
import type { GraphViewState } from './protocol';

/**
 * Stands in for the FoamGraph element: applying a style or a restored
 * state mutates the interactive state a later getViewState() snapshots,
 * mirroring how Lit applies the real element's updates between messages.
 */
const makeElement = () => {
  const element: any = {
    state: { labelMaxLength: 24 } as GraphViewState,
    getViewState: () => ({ ...element.state }),
    applyViewState: (state: GraphViewState) => {
      element.state = { labelMaxLength: 24, ...state };
    },
    selectNote: vi.fn(),
  };
  Object.defineProperty(element, 'graphStyle', {
    set(style: { showNodesOfType?: Record<string, boolean> }) {
      if (style?.showNodesOfType) {
        element.state.showNodesOfType = {
          ...element.state.showNodesOfType,
          ...style.showNodesOfType,
        };
      }
    },
  });
  Object.defineProperty(element, 'graphData', { set() {} });
  return element;
};

describe('createHostBridge', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces view-state saves to one message', () => {
    const post = vi.fn();
    const bridge = createHostBridge(makeElement(), post);

    bridge.scheduleViewStateSave();
    bridge.scheduleViewStateSave();
    expect(post).not.toHaveBeenCalled();

    vi.advanceTimersByTime(VIEW_STATE_DEBOUNCE_MS);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('echoes the view name of the last restore with each save', () => {
    const post = vi.fn();
    const bridge = createHostBridge(makeElement(), post);
    bridge.handleMessage({
      type: 'didRestoreViewState',
      payload: { viewName: 'Journal', state: {} },
    });

    bridge.scheduleViewStateSave();
    vi.advanceTimersByTime(VIEW_STATE_DEBOUNCE_MS);

    expect(post.mock.calls[0][0].payload.viewName).toBe('Journal');
  });

  it('flushes a pending save under the old view before applying a restore', () => {
    const post = vi.fn();
    const element = makeElement();
    const bridge = createHostBridge(element, post);
    bridge.handleMessage({
      type: 'didRestoreViewState',
      payload: { viewName: 'Journal', state: {} },
    });

    element.state.labelMaxLength = 10; // user gesture...
    bridge.scheduleViewStateSave();
    bridge.handleMessage({
      // ...then a switch to another view before the debounce fires
      type: 'didRestoreViewState',
      payload: { viewName: 'Clean', state: { labelMaxLength: 30 } },
    });

    expect(post).toHaveBeenCalledTimes(1);
    const { viewName, state } = post.mock.calls[0][0].payload;
    expect(viewName).toBe('Journal');
    expect(state.labelMaxLength).toBe(10);
  });

  it('flushes a pending save before an incoming style can leak into it', () => {
    const post = vi.fn();
    const element = makeElement();
    const bridge = createHostBridge(element, post);
    bridge.handleMessage({
      type: 'didRestoreViewState',
      payload: { viewName: 'Journal', state: {} },
    });

    element.state.labelMaxLength = 10; // user gesture...
    bridge.scheduleViewStateSave();
    bridge.handleMessage({
      // ...then a view switch: the new view's declared style arrives
      // first and must not be absorbed into Journal's save
      type: 'didUpdateStyle',
      payload: { showNodesOfType: { tag: false } },
    });

    expect(post).toHaveBeenCalledTimes(1);
    const { viewName, state } = post.mock.calls[0][0].payload;
    expect(viewName).toBe('Journal');
    expect(state.labelMaxLength).toBe(10);
    expect(state.showNodesOfType?.tag).toBeUndefined();
  });

  it('flushes a pending save on demand (pagehide)', () => {
    const post = vi.fn();
    const bridge = createHostBridge(makeElement(), post);

    bridge.scheduleViewStateSave();
    bridge.flushPendingViewState();

    expect(post).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(VIEW_STATE_DEBOUNCE_MS);
    expect(post).toHaveBeenCalledTimes(1);
  });
});
