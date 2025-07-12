// This file runs in the test environment where Jest globals are available

// Clean up after each test file to prevent hanging threads
afterAll(async () => {
  const vscode = require('../vscode-mock');

  // Force cleanup of any async operations
  if (vscode.forceCleanup) {
    await vscode.forceCleanup();
  }
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

  // Wait for any remaining async operations to complete
  await new Promise(resolve => setImmediate(resolve));
});
