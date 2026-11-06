import './foam-graph';
import { createHostBridge } from './host-bridge';
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

const bridge = createHostBridge(element, message =>
  vscode.postMessage(message)
);

window.addEventListener('message', (event: MessageEvent) => {
  bridge.handleMessage(event.data as ExtensionMessage);
});

element.addEventListener('node-click', (e: Event) => {
  vscode.postMessage({
    type: 'webviewDidSelectNode',
    payload: (e as CustomEvent).detail,
  });
});

element.addEventListener('view-state-change', () => {
  bridge.scheduleViewStateSave();
});

// Best effort: don't lose a change made just before the panel is closed.
window.addEventListener('pagehide', () => bridge.flushPendingViewState());

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
