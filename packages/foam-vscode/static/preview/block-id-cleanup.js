(function () {
  const blockIdRegex = /\s*\^[\w-]+$/gm;
  const standaloneBlockIdRegex = /^\s*\^[\w-]+$/m;

  function cleanupBlockIds() {
    // Handle standalone block IDs (e.g., on their own line)
    // These will be rendered as <p>^block-id</p>
    document.querySelectorAll('p').forEach(p => {
      if (p.textContent.match(standaloneBlockIdRegex)) {
        p.style.display = 'none';
      }
    });

    // Handle block IDs at the end of other elements (e.g., headers, list items)
    // These will be rendered as <h1 id="some-id">Header ^block-id</h1>
    // or <li>List item ^block-id</li>
    // We need to iterate through all text nodes to find and remove them.
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    let node;
    while ((node = walker.nextNode())) {
      // Only remove block IDs if the text node is NOT inside an anchor tag (link)
      if (node.parentNode && node.parentNode.tagName !== 'A') {
        if (node.nodeValue.match(blockIdRegex)) {
          node.nodeValue = node.nodeValue.replace(blockIdRegex, '');
        }
      }
    }
  }

  // Run the cleanup initially
  cleanupBlockIds();

  // Observe for changes in the DOM and run cleanup again
  const observer = new MutationObserver(cleanupBlockIds);
  observer.observe(document.body, { childList: true, subtree: true });
})();
