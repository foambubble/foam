import './foam-graph';
import type { ExtensionMessage, WebviewMessage } from './protocol';
import type { FoamGraph } from './foam-graph';

declare function acquireVsCodeApi(): {
  postMessage: (msg: WebviewMessage) => void;
};

const vscode = (() => {
  try {
    return acquireVsCodeApi();
  } catch {
    // Not in VS Code — provide a mock for browser-based development
    return {
      postMessage: (msg: unknown) =>
        console.log('[mock vscode] postMessage', msg),
    };
  }
})();

const element = document.createElement('foam-graph') as FoamGraph;
element.showControls = true;
document.getElementById('app')!.appendChild(element);

// The view the current display state belongs to; set by every restore and
// echoed with saves, so a save debounced across a view switch still lands
// in the bucket it was made in.
let currentViewName: string | undefined;
let viewStateTimer: ReturnType<typeof setTimeout> | undefined;

const postViewState = () => {
  vscode.postMessage({
    type: 'webviewDidChangeViewState',
    payload: { viewName: currentViewName, state: element.getViewState() },
  });
};

const flushPendingViewState = () => {
  if (viewStateTimer === undefined) return;
  clearTimeout(viewStateTimer);
  viewStateTimer = undefined;
  postViewState();
};

window.addEventListener('message', (event: MessageEvent) => {
  const message = event.data as ExtensionMessage;
  switch (message.type) {
    case 'didUpdateGraphData':
      element.graphData = message.payload;
      break;
    case 'didUpdateStyle':
      element.graphStyle = message.payload;
      break;
    case 'didRestoreViewState':
      // save any in-flight change under the view it was made in before
      // the incoming state replaces it
      flushPendingViewState();
      currentViewName = message.payload.viewName;
      element.applyViewState(message.payload.state);
      break;
    case 'didSelectNote':
      element.selectNote(message.payload);
      break;
  }
});

element.addEventListener('node-click', (e: Event) => {
  vscode.postMessage({
    type: 'webviewDidSelectNode',
    payload: (e as CustomEvent).detail,
  });
});

// Debounced so slider drags produce one persisted update, not one per
// tick; the snapshot is taken when the timer fires, not per event.
element.addEventListener('view-state-change', () => {
  clearTimeout(viewStateTimer);
  viewStateTimer = setTimeout(() => {
    viewStateTimer = undefined;
    postViewState();
  }, 250);
});

// Best effort: don't lose a change made just before the panel is closed.
window.addEventListener('pagehide', flushPendingViewState);

window.addEventListener('error', (error: ErrorEvent) => {
  vscode.postMessage({
    type: 'error',
    payload: {
      message: error.message,
      filename: error.filename,
      lineno: error.lineno,
      colno: error.colno,
      error: error.error,
    },
  });
});

vscode.postMessage({ type: 'webviewDidLoad' });
