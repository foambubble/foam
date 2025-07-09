# Testing in Foam VS Code Extension

This document explains the testing strategy and conventions used in the Foam VS Code extension.

## Test File Types

We use two distinct types of test files, each serving different purposes:

### `.test.ts` Files - Pure Unit Tests

- **Purpose**: Test business logic and algorithms in complete isolation
- **Dependencies**: No VS Code APIs dependencies
- **Environment**: Pure Jest with Node.js
- **Speed**: Very fast execution
- **Location**: Throughout the codebase alongside source files

### `.spec.ts` Files - Integration Tests with VS Code APIs

- **Purpose**: Test features that integrate with VS Code APIs and user workflows
- **Dependencies**: Will likely depend on VS Code APIs (`vscode` module), otherwise avoid incurring the perfomance hit
- **Environment**: Can run in TWO environments:
  - **Mock Environment**: Jest with VS Code API mocks (fast)
  - **Real VS Code**: Full VS Code extension host (slow but comprehensive)
- **Speed**: Depends on environment (see performance section below)
- **Location**: Primarily in `src/features/` and service layers

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
| **`.test.ts`**        | Pure Jest              | fastest          | **No**           |
| **`.spec.ts` (mock)** | Jest + VS Code Mocks   | fast             | **Yes** (mocked) |
| **`.spec.ts` (real)** | VS Code Extension Host | sloooooow.       | **Yes** (real)   |

## Running Tests

### Available Commands

- **`yarn test:unit`**: Runs only `.test.ts` files (no VS Code dependencies)
- **`yarn test:unit-with-specs`**: Runs `.test.ts` + `@unit-ready` marked `.spec.ts` files using mocks
- **`yarn test:e2e`**: Runs all `.spec.ts` files in full VS Code extension host
- **`yarn test`**: Runs both unit and e2e test suites sequentially

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
const format = getFoamVsCodeConfig('openDailyNote.filenameFormat');

// After (defensive)
const format = getFoamVsCodeConfig(
  'openDailyNote.filenameFormat',
  'yyyy-mm-dd'
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
