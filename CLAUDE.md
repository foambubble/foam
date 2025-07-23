# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Commands

### Development

- `yarn install` - Install dependencies
- `yarn build` - Build all packages
- `yarn watch` - Watch mode for development
- `yarn clean` - Clean build outputs
- `yarn reset` - Full clean, install, and build

### Testing

- `yarn test` - Run all tests (unit + integration)
- `yarn test:unit-with-specs` - Run only unit tests (\*.test.ts files and the .spec.ts files marked a vscode-mock friendly)
- `yarn test:e2e` - Run only integration tests (\*.spec.ts files)
- `yarn lint` - Run linting
- `yarn test-reset-workspace` to clean test workspace

Unit tests run in Node.js environment using Jest
Integration tests require VS Code extension host

While in development we mostly want to use `yarn test:unit-with-specs`.
When multiple tests are failing, look at all of them, but only focus on fixing the first one. Once that is fixed, run the test suite again and repeat the process.

When writing tests keep mocking to a bare minimum. Code should be written in a way that is easily testable and if I/O is necessary, it should be done in appropriate temporary directories.
Never mock anything that is inside `packages/foam-vscode/src/core/`.

Use the utility functions from `test-utils.ts` and `test-utils-vscode.ts` and `test-datastore.ts`.

To improve readability of the tests, set up the test and tear it down within the test case (as opposed to use other functions like `beforeEach` unless it's much better to do it that way)

## Repository Structure

This is a monorepo using Yarn workspaces with the main VS Code extension in `packages/foam-vscode/`.

### Key Directories

- `packages/foam-vscode/src/core/` - Platform-agnostic business logic (NO vscode dependencies)
- `packages/foam-vscode/src/features/` - VS Code-specific features and UI
- `packages/foam-vscode/src/services/` - service implementations, might have VS Code dependency, but we try keep that to a minimum
- `packages/foam-vscode/src/test/` - Test utilities and mocks
- `docs/` - Documentation and user guides

### Important Constraint

Code in `packages/foam-vscode/src/core/` MUST NOT depend on the `vscode` library or any files outside the core directory. This maintains platform independence.

## Architecture Overview

### Core Abstractions

**FoamWorkspace** - Central repository managing all resources (notes, attachments)

- Uses reversed trie for efficient resource lookup
- Event-driven updates (onDidAdd, onDidUpdate, onDidDelete)
- Handles identifier resolution for short-form linking

**FoamGraph** - Manages relationship graph between resources

- Tracks links and backlinks between resources
- Real-time updates when workspace changes
- Handles placeholder resources for broken links

**ResourceProvider Pattern** - Pluggable architecture for different file types

- `MarkdownProvider` for .md files
- `AttachmentProvider` for other file types
- Extensible for future resource types

**DataStore Interface** - Abstract file system operations

- Platform-agnostic file access with configurable filtering
- Supports both local and remote file systems

### Feature Integration Pattern

Features are registered as functions receiving:

```typescript
(context: ExtensionContext, foamPromise: Promise<Foam>) => void
```

This allows features to:

- Register VS Code commands, providers, and event handlers
- Access the Foam workspace when ready
- Extend markdown-it for preview rendering

### Testing Conventions

- `*.test.ts` - Unit tests using Jest
- `*.spec.ts` - Integration tests requiring VS Code extension host
- Tests live alongside source code in `src/`
- Test cases should be phrased in terms of aspects of the feature being tested (expected behaviors), as they serve both as validation of the code as well as documentation of what the expected behavior for the code is in different situations. They should include the happy paths and edge cases.

## Development Workflow

- Whenever working on a feature or issue, let's always come up with a plan first, then save it to a file called `/.agent/current-plan.md`, before getting started with code changes. Update this file as the work progresses.
- Let's use pure functions where possible to improve readability and testing.
- After saving a file, always run `prettier` on it to adjust its formatting.

### Adding New Features

1. Create feature in `src/features/` directory
2. Register feature in `src/features/index.ts`
3. Add tests (both unit and integration as needed)
4. Update configuration in `package.json` if needed

### Working on an issue

1. Get the issue information from github
2. Define a step by step plan for addressing the issue
3. Create tests for the feature
4. Starting from the first test case, implement the feature so the test passes

### Core Logic Changes

1. Modify code in `src/core/` (ensure no vscode dependencies)
2. Add comprehensive unit tests
3. Update integration tests in features that use the core logic

## Configuration

The extension uses VS Code's configuration system with the `foam.*` namespace.
You can find all the settings in `/packages/foam-vscode/package.json`

## Common Development Tasks

### Extending Core Functionality

When adding to `src/core/`:

- Keep platform-agnostic (no vscode imports)
- Add comprehensive unit tests
- Consider impact on graph and workspace state
- Update relevant providers if needed

## Dependencies

- **Runtime**: VS Code API, markdown parsing, file watching
- **Development**: TypeScript, Jest, ESLint, esbuild
- **Key Libraries**: remark (markdown parsing), lru-cache, lodash

The extension supports both Node.js and browser environments via separate build targets.

# GitHub CLI Integration

To interact with the github repo we will be using the `gh` command.
ALWAYS ask before performing a write operation on Github.

## Common Commands for Claude Code Integration

### Issues

```bash
# List all issues
gh issue list

# Filter issues by milestone
gh issue list --milestone "v1.0.0"

# Filter issues by assignee
gh issue list --assignee @me
gh issue list --assignee username

# Filter issues by label
gh issue list --label "bug"
gh issue list --label "enhancement,priority-high"

# Filter issues by state
gh issue list --state open
gh issue list --state closed
gh issue list --state all

# Combine filters
gh issue list --milestone "v1.0.0" --label "bug" --assignee @me

# View specific issue
gh issue view 123

# Create issue
gh issue create --title "Bug fix" --body "Description"

# Add comment to issue
gh issue comment 123 --body "Update comment"
```

### Pull Requests

```bash
# List all PRs
gh pr list

# Filter PRs the same way as for filters (for example, here is by milestone)
gh pr list --milestone "v1.0.0"

# View PR details
gh pr view 456

# Create PR
gh pr create --title "Feature" --body "Description"

# Check out PR locally
gh pr checkout 456

# Add review comment
gh pr comment 456 --body "LGTM"
```
