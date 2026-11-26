# Testing in Foam VS Code Extension

This document explains the testing strategy and conventions used in the Foam VS Code extension.

## Test File Types

We use two distinct types of test files, each serving different purposes, plus [UI tests](#ui-tests) for what only a real VS Code window shows:

### `.test.ts` Files - Pure Unit Tests

- **Purpose**: Test business logic and algorithms in complete isolation
- **Dependencies**: No VS Code APIs dependencies
- **Environment**: Vitest with Node.js
- **Speed**: Very fast execution
- **Location**: Throughout the codebase alongside source files

### `.spec.ts` Files - Integration Tests with VS Code APIs

- **Purpose**: Test features that integrate with VS Code APIs and user workflows
- **Dependencies**: Will likely depend on VS Code APIs (`vscode` module), otherwise avoid incurring the performance hit
- **Environment**: Can run in TWO environments:
  - **Mock Environment**: Vitest with VS Code API mocks (fast)
  - **Real VS Code**: Full VS Code extension host (slow but comprehensive)
- **Speed**: Depends on environment (see performance section below)
- **Location**: Primarily in `src/vscode/features/` and service layers

## Key Principle: Environment Flexibility for `.spec.ts` Files

**`.spec.ts` files use VS Code APIs**, but they can run in different environments:

- **Mock Environment**: Uses our VS Code API mocks for speed
- **Real VS Code**: Uses actual VS Code extension host for full integration testing

This dual-environment capability allows us to:

- Run specs quickly during development (mock environment)
- Verify full integration during CI/CD (real VS Code environment)
- Gradually migrate specs to mock-compatible implementations

## Performance Comparison

| Test Type             | Environment            | Typical Duration | VS Code APIs     |
| --------------------- | ---------------------- | ---------------- | ---------------- |
| **`.test.ts`**        | Vitest (Node.js)       | fastest          | **No**           |
| **`.spec.ts` (mock)** | Vitest + VS Code Mocks | fast             | **Yes** (mocked) |
| **`.spec.ts` (real)** | VS Code Extension Host | sloooooow.       | **Yes** (real)   |

## Running Tests

### Available Commands

- **`yarn test:unit`**: Runs `.test.ts` files (no VS Code dependencies) + `@unit-ready` marked `.spec.ts` files using mocks
- **`yarn test:unit-without-specs`**: Runs only `.test.ts` files
- **`yarn test:e2e`**: Runs all `.spec.ts` files in full VS Code extension host
- **`yarn test`**: Runs both unit and e2e test suites sequentially
- **`yarn workspace foam-vscode test:ui [files]`**: Runs `.ui.ts` files in a real VS Code window — see [UI tests](#ui-tests)

## Mock Environment Migration

We're gradually enabling `.spec.ts` files to run in our fast mock environment while maintaining their ability to run in real VS Code.

### The `@unit-ready` Annotation

Spec files marked with `/* @unit-ready */` can run in both environments:

```typescript
/* @unit-ready */
import * as vscode from 'vscode';
// ... test uses VS Code APIs but works with our mocks
```

### Common Migration Fixes

**Configuration defaults**: Our mocks don't load package.json defaults

```typescript
// Before
const afterCompletion = getFoamVsCodeConfig('dateSnippets.afterCompletion');

// After (defensive)
const afterCompletion = getFoamVsCodeConfig(
  'dateSnippets.afterCompletion',
  'createNote'
);
```

**File system operations**: Ensure proper async handling

```typescript
// Mock file operations are immediate but still async
await vscode.workspace.fs.writeFile(uri, content);
```

### When NOT to Migrate

Some specs should remain real-VS-Code-only:

- Tests verifying complex VS Code UI interactions
- Tests requiring real file system watching with timing
- Tests validating extension packaging or activation
- Tests that depend on VS Code's complex internal state management

## Mock System Capabilities

Our `vscode-mock.ts` provides comprehensive VS Code API mocking:

## Contributing Guidelines

When adding new tests:

1. **Choose the right type**:

   - Use `.test.ts` for pure business logic with no VS Code dependencies
   - Use `.spec.ts` for anything that needs VS Code APIs

2. **Consider mock compatibility**:

   - When writing `.spec.ts` files, consider if they could run in mock environment
   - Add `/* @unit-ready */` if the test works with our mocks

3. **Follow naming conventions**:

   - Test files should be co-located with source files when possible
   - Use descriptive test names that explain the expected behavior

4. **Performance awareness**:
   - Prefer unit tests for business logic (fastest)
   - Use mock-compatible specs for VS Code integration (fast)
   - Reserve real VS Code specs for complex integration scenarios (comprehensive)

This testing strategy gives us the best of both worlds: fast feedback during development and comprehensive integration verification when needed.

## UI tests

A `.spec.ts` calls the VS Code API but can't see the window. A `.ui.ts` drives a real VS Code window and reads what is drawn: a webview such as the graph, editor widgets such as completion and hover, theme colours, what survives a window reload. Write one for an acceptance criterion declared `_verify: ui_`, which is a criterion about the window that the VS Code API can't check. If the API can check it, write a `.spec.ts`.

Each test opens its own window, with this checkout's extension, a fresh profile, and a workspace of files the test defines. It runs on the same pinned VS Code build as e2e (`src/test/support/vscode-version.ts`), driven by Vitest and `playwright-core`:

```typescript
import { expect, test } from 'vitest';
import { openVSCode } from '../../../test/ui/vscode-window';

test('hovering a wikilink shows the note it links to', async () => {
  const vscode = await openVSCode({
    files: { 'a.md': 'See [[b]].\n', 'b.md': '# B\n\nThe b note.\n' },
  });
  await vscode.openFile('a.md');
  await vscode.hoverText('[[b]]');
  await expect
    .poll(() => vscode.page.getByRole('tooltip').innerText())
    .toContain('The b note.');
});
```

- **Find things by role and accessible name**, as Playwright's `getByRole` does. VS Code's CSS classes change between versions. The harness in `src/test/ui/vscode-window.ts` is the one place allowed to read VS Code internals, and only where nothing accessible exists.
- **Assert the behaviour, not the element.** Check what is drawn after the action the criterion describes, not only that a button exists.
- **Screenshots**: a failing test saves `failure.png` and prints its path. `await vscode.screenshot('name')` saves named ones, which is how a test leaves evidence for a criterion a person judges. They go under `packages/foam-vscode/out/ui-test-results/<file>/<test>/`. A test empties its own folder when it runs, so screenshots from tests you didn't run stay.

Run them from a built checkout (`yarn build`), on a machine with a display. On Linux without one, prefix the command with `xvfb-run`:

```bash
yarn workspace foam-vscode test:ui                                   # all of them
yarn workspace foam-vscode test:ui src/vscode/features/notes/connections.ui.ts
```

UI tests stay out of CI, which is slow enough already. The exception is a pull request that adds a `.ui.ts`: its checks run the UI tests it adds, and only those. A pull request that changes an existing UI test doesn't run it, so its author does. The [UI tests workflow](../../.github/workflows/ui-tests.yml) runs the whole set weekly against `main`, and by hand before a release.

## Graph Webview (`@foam/graph-view`)

The webview component has its own test stack, separate from the extension tests.

- **Framework**: [Vitest](https://vitest.dev/) with [happy-dom](https://github.com/capricorn86/happy-dom) for a browser-like environment
- **Location**: Test files live in `packages/foam-graph/src/`
- **Command**: `yarn workspace @foam/graph-view test`

The webview tests focus on the framework-agnostic library code in `src/lib/` (graph utilities, color logic, painter). Lit component rendering tests can be added as the component grows.
