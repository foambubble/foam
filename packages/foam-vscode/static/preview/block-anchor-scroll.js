/**
 * Handles in-preview scroll-to-fragment for Foam block anchors.
 *
 * Block anchor elements have ids prefixed with '__' (e.g. id="__myblock").
 *
 * Two cases:
 *
 * 1. Same-document links ([[#^blockid]] → href="#__blockid"):
 *    VS Code's click handler returns early for '#'-prefixed hrefs, relying on
 *    browser-native hash navigation. In VS Code's webview this doesn't reliably
 *    scroll to arbitrary elements (only headings work via the sync mechanism).
 *    We intercept the click ourselves and call scrollIntoView directly.
 *
 * 2. Cross-document links ([[note#^blockid]] → href="/note.md#__blockid"):
 *    VS Code opens the new note's preview. We stash the fragment in
 *    sessionStorage before the navigation happens, and read it when the target
 *    note's preview script runs (either on initial load or via the
 *    vscode.markdown.updateContent event for in-place re-renders).
 */

const BLOCK_ANCHOR_PREFIX = '__';
const FRAGMENT_STORAGE_KEY = 'foam-block-anchor-fragment';

function scrollToBlockAnchor(fragment) {
  if (!fragment || !fragment.startsWith(BLOCK_ANCHOR_PREFIX)) {
    return false;
  }
  const el = document.getElementById(fragment);
  if (el) {
    el.scrollIntoView();
    return true;
  }
  return false;
}

function getFragmentFromSettings() {
  try {
    const dataEl = document.getElementById('vscode-markdown-preview-data');
    if (!dataEl) {
      return null;
    }
    const settings = JSON.parse(dataEl.getAttribute('data-settings') ?? '{}');
    const state = JSON.parse(dataEl.getAttribute('data-state') ?? '{}');
    return settings.fragment ?? state.fragment ?? null;
  } catch {
    return null;
  }
}

function getPendingFragment() {
  try {
    const f = sessionStorage.getItem(FRAGMENT_STORAGE_KEY);
    if (f) {
      sessionStorage.removeItem(FRAGMENT_STORAGE_KEY);
    }
    return f;
  } catch {
    return null;
  }
}

function tryScrollFromContext() {
  scrollToBlockAnchor(getFragmentFromSettings() ?? getPendingFragment());
}

// Case 1 & 2: intercept all block anchor link clicks (window capture phase runs
// before VS Code's document-level handler).
window.addEventListener(
  'click',
  e => {
    const a = e.target.closest('a[href]');
    if (!a) {
      return;
    }
    const href = a.getAttribute('href');
    if (!href) {
      return;
    }

    const hashIndex = href.lastIndexOf('#');
    if (hashIndex === -1) {
      return;
    }

    const fragment = href.slice(hashIndex + 1); // fragment without '#'
    if (!fragment.startsWith(BLOCK_ANCHOR_PREFIX)) {
      return;
    }

    const pathPart = href.slice(0, hashIndex);

    if (!pathPart) {
      // Same-document link: scroll directly and suppress default navigation.
      if (scrollToBlockAnchor(fragment)) {
        e.preventDefault();
        e.stopPropagation();
      }
    } else {
      // Cross-document link: stash the fragment so the target note's preview
      // script can pick it up on load or on the updateContent event.
      try {
        sessionStorage.setItem(FRAGMENT_STORAGE_KEY, fragment);
      } catch {
        // sessionStorage unavailable — silently ignore.
      }
    }
  },
  true
);

// On (re)load: scroll to any pending block anchor fragment. markdown.previewScripts
// execute after VS Code has appended the rendered content, so the element is in DOM.
tryScrollFromContext();

// Also handle in-place re-renders triggered by live editing or cross-document
// navigation that reuses the same webview panel.
window.addEventListener('vscode.markdown.updateContent', tryScrollFromContext);
