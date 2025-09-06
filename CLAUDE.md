# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Foam is a personal knowledge management and sharing system, built on Visual Studio Code and GitHub. It allows users to organize research, keep re-discoverable notes, write long-form content, and optionally publish it to the web. The main goals are to help users create relationships between thoughts and information, supporting practices like building a "Second Brain" or a "Zettelkasten". Foam is free, open-source, and extensible, giving users ownership and control over their information. The target audience includes individuals interested in personal knowledge management, note-taking, and content creation, particularly those familiar with VS Code and GitHub.

## Quick Commands

All the following commands are to be executed from the `packages/foam-vscode` directory

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

Unit tests are named `*.test.ts` and integration tests are `*.spec.ts`. These test files live alongside the code in the `src` directory. An integration test is one that has a direct or indirect dependency on `vscode` module.
There is a mock `vscode` module that can be used to run most integration tests without starting VS Code. Tests that can use this mock are start with the line `/* @unit-ready */`.

- If you are interested in a test inside a `*.test.ts` file, run `yarn test:unit`
- If you are interested in a test inside a `*.spec.ts` file that starts with `/* @unit-ready */` run `yarn test:unit-with-specs`
- If you are interested in a test inside a `*.spec.ts` file that does not include `/* @unit-ready */` run `yarn test`

While in development we mostly want to use `yarn test:unit-with-specs`.
When multiple tests are failing, look at all of them, but only focus on fixing the first one. Once that is fixed, run the test suite again and repeat the process.

When writing tests keep mocking to a bare minimum. Code should be written in a way that is easily testable and if I/O is necessary, it should be done in appropriate temporary directories.
Never mock anything that is inside `packages/foam-vscode/src/core/`.

Use the utility functions from `test-utils.ts` and `test-utils-vscode.ts` and `test-datastore.ts`.

To improve readability of the tests, set up the test and tear it down within the test case (as opposed to use other functions like `beforeEach` unless it's much better to do it that way)

Never fix a test by adjusting the expectation if the expectation is correct, test must be fixed by addressing the issue with the code.

## Repository Structure

This is a monorepo using Yarn workspaces with the main VS Code extension in `packages/foam-vscode/`.

### Key Directories

- `packages/foam-vscode/src/core/` - Platform-agnostic business logic (NO vscode dependencies)
- `packages/foam-vscode/src/features/` - VS Code-specific features and UI
- `packages/foam-vscode/src/services/` - service implementations, might have VS Code dependency, but we try keep that to a minimum
- `packages/foam-vscode/src/test/` - Test utilities and mocks
- `docs/` - Documentation and user guides

### File Naming Patterns

Test files follow `*.test.ts` for unit tests and `*.spec.ts` for integration tests, living alongside the code in `src`. An integration test is one that has a direct or indirect dependency on `vscode` package.

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

We build production code together. I handle implementation details while you guide architecture and catch complexity early.
When working on an issue, check if a `.agent/tasks/<issue-id>-<sanitized-title>.md` exists. If not, suggest whether we should start by doing a research on it (using the `/research-issue <issue-id>`) command.
Whenever we work together on a task, feel free to challenge my assumptions and ideas and be critical if useful.

## Core Workflow: Research → Plan → Implement → Validate

**Start every feature with:** "Let me research the codebase and create a plan before implementing."

1. **Research** - Understand existing patterns and architecture
2. **Plan** - Propose approach and verify with you
3. **Implement** - Build with tests and error handling
4. **Validate** - ALWAYS run formatters, linters, and tests after implementation

- Whenever working on a feature or issue, let's always come up with a plan first, then save it to a file called `/.agent/current-plan.md`, before getting started with code changes. Update this file as the work progresses.
- Let's use pure functions where possible to improve readability and testing.

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
