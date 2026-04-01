// Intentionally empty: E2E tests run inside the VS Code extension host main
// process where `require('vscode')` is natively available — no mocking needed.
// Foam-specific setup (workspace configuration) is done in suite.ts before
// Vitest starts, since it requires awaiting an async VS Code API call.
