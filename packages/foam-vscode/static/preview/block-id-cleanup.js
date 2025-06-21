(function () {
  const blockIdRegex = /\s*\^[\w-]+$/gm;
  const standaloneBlockIdRegex = /^\s*\^[\w-]+$/m;

  function cleanupBlockIds(rootElement = document.body) {
    // Handle standalone block IDs (e.g., on their own line)
    rootElement.querySelectorAll('p').forEach(p => {
      if (p.textContent.match(standaloneBlockIdRegex)) {
        p.style.display = 'none';
      }
    });

    // Handle block IDs at the end of other elements
    const walker = document.createTreeWalker(
      rootElement,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    let node;
    while ((node = walker.nextNode())) {
      if (node.parentNode && node.parentNode.tagName !== 'A') {
        if (node.nodeValue.match(blockIdRegex)) {
          node.nodeValue = node.nodeValue.replace(blockIdRegex, '');
        }
      }
    }
  }

  // Run the cleanup initially on the whole body
  cleanupBlockIds(document.body);

  // Observe for changes in the DOM and run cleanup again, but only
  // on the nodes that were added. This is more efficient and avoids
  // the race conditions of the previous implementation.
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        // We only care about element nodes, not text nodes etc.
        if (node.nodeType === 1) {
          cleanupBlockIds(node);
        }
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
