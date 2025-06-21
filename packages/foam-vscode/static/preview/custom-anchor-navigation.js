(function () {
  // Only acquire the API if it hasn't already been acquired
  const vscode =
    typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : window.vscode;

  // --- CLICK HANDLER for in-page navigation ---
  document.addEventListener(
    'click',
    e => {
      const link = e.target.closest('a.foam-note-link');
      if (!link) {
        return;
      }

      const href = link.getAttribute('data-href');
      if (!href) return;

      e.preventDefault();
      e.stopPropagation();

      // Get the current document's URI from the webview's window.location
      // This is needed to resolve same-document links correctly in the extension host.
      const currentDocUri = window.location.href.split('#')[0];

      vscode.postMessage({
        command: 'foam.open-link',
        href: href,
        sourceUri: currentDocUri,
      });
      // Otherwise, it's a simple file link without an anchor,
      // so we can let the default handler manage it.
      // No 'else' block needed, as 'return' will implicitly let it pass.
    },
    true
  );
})();
