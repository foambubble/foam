import type { FoamGraph } from './foam-graph';
import type { ExtensionMessage, WebviewMessage } from './protocol';

export const VIEW_STATE_DEBOUNCE_MS = 250;

type HostElement = Pick<
  FoamGraph,
  'graphData' | 'graphStyle' | 'selectNote' | 'applyViewState' | 'getViewState'
>;

/**
 * Wires a FoamGraph element to the extension host: applies incoming
 * messages, and reports view-state changes back, debounced so a slider
 * drag produces one persisted update rather than one per tick.
 *
 * The view the current state belongs to is taken from each restore and
 * echoed with every save, so a save debounced across a view switch still
 * lands in the bucket it was made in.
 */
export function createHostBridge(
  element: HostElement,
  post: (message: WebviewMessage) => void
) {
  let currentViewName: string | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const postViewState = () => {
    post({
      type: 'webviewDidChangeViewState',
      payload: { viewName: currentViewName, state: element.getViewState() },
    });
  };

  const flushPendingViewState = () => {
    if (timer === undefined) return;
    clearTimeout(timer);
    timer = undefined;
    postViewState();
  };

  return {
    handleMessage(message: ExtensionMessage) {
      switch (message.type) {
        case 'didUpdateGraphData':
          element.graphData = message.payload;
          break;
        case 'didUpdateStyle':
          // the style feeds the element's interactive state (declared
          // groups and type filters), so a pending save must be taken
          // before it lands or it would absorb the incoming view's config
          flushPendingViewState();
          element.graphStyle = message.payload;
          break;
        case 'didRestoreViewState':
          // save any in-flight change under the view it was made in
          // before the incoming state replaces it
          flushPendingViewState();
          currentViewName = message.payload.viewName;
          element.applyViewState(message.payload.state);
          break;
        case 'didSelectNote':
          element.selectNote(message.payload);
          break;
      }
    },
    /** Called on the element's view-state-change event. */
    scheduleViewStateSave() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        postViewState();
      }, VIEW_STATE_DEBOUNCE_MS);
    },
    /**
     * Called on the element's view-state-reset event. A save still pending
     * is dropped, not flushed: it would write the bucket the reset clears.
     */
    resetViewState() {
      clearTimeout(timer);
      timer = undefined;
      post({
        type: 'webviewDidResetViewState',
        payload: { viewName: currentViewName },
      });
    },
    /** Best effort on pagehide: don't lose a change made just before closing. */
    flushPendingViewState,
  };
}
