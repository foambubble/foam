# Contribution Guide

Foam is open to contributions of any kind, including but not limited to code, documentation, ideas, and feedback.
This guide helps new and seasoned contributors find their way around the Foam codebase. For a comprehensive guide about contributing to open-source projects in general, [see here](https://blog.robsewell.com/blog/how-to-fork-a-github-repository-and-contribute-to-an-open-source-project/).

## Getting Up To Speed

Before you start contributing we recommend that you read the following:

- [Principles](docs/principles.md) - The guiding principles behind Foam.
- [Code of Conduct](docs/dev/code-of-conduct.md) - Rules we hope every contributor aims to follow, allowing everyone to participate in our community!
- [AGENTS.md](AGENTS.md) - How code is written and reviewed here. It is addressed to coding agents, but the conventions are the project's: PRs are reviewed against them whether a human or an agent wrote the code.

To get yourself familiar with the codebase you can also browse [this repo](https://app.komment.ai/wiki/github/foambubble/foam)

## Diving In

We understand that diving in an unfamiliar codebase may seem scary,
to make it easier for new contributors we provide some resources:

You can also see [existing issues](https://github.com/foambubble/foam/issues) and help out!
Finally, the easiest way to help, is to use it and provide feedback by [submitting issues](https://github.com/foambubble/foam/issues/new/choose) or participating in the [Foam Community Discord](https://discord.com/invite/HV2tn2FpEk)!

## Contributing

If you're interested in contributing, this short guide will help you get things set up locally (assuming [Node.js 22](https://nodejs.org/) and [yarn](https://yarnpkg.com/) are already installed on your system; `.nvmrc` selects the right Node if you use nvm).
You can also use the provided [Dev Containers](docs/dev/devcontainers.md) to avoid installing dependencies locally. With the Dev Containers extension installed, open the repository in VS Code and run **Dev Containers: Reopen in Container**.

1. Fork the project to your GitHub account by clicking the "Fork" button on the top right hand corner of the project's [home repository page](https://github.com/foambubble/foam).
2. Clone your newly forked repo locally:

   `git clone https://github.com/your_username/foam.git`

3. Install the necessary dependencies by running this command from the root of the cloned repository:

   `yarn install`

4. From the repository root, run the command:

   `yarn build`

You should now be ready to start working!

### Structure of the project

Foam code and documentation live in the monorepo at [foambubble/foam](https://github.com/foambubble/foam/).

- [/docs](https://github.com/foambubble/foam/tree/main/docs): documentation and [recipes](docs/user/recipes/recipes.md).

Exceptions to the monorepo are:

- The starter template at [foambubble/foam-template](https://github.com/foambubble/)
- All other [recommended extensions](docs/user/getting-started/recommended-extensions.md) live in their respective GitHub repos

This project uses [Yarn workspaces](https://classic.yarnpkg.com/en/docs/workspaces/).

The monorepo contains five Yarn workspace packages:

- [/packages/foam-vscode](https://github.com/foambubble/foam/tree/main/packages/foam-vscode) - The VS Code extension.
- [/packages/foam-core](https://github.com/foambubble/foam/tree/main/packages/foam-core) - Platform-agnostic core logic (`@foam/core`, published to npm as `foam-core`).
- [/packages/foam-cli](https://github.com/foambubble/foam/tree/main/packages/foam-cli) - The CLI (`@foam/cli`, published to npm as `foam-cli`).
- [/packages/foam-graph](https://github.com/foambubble/foam/tree/main/packages/foam-graph) - The graph visualization web component (`@foam/graph-view`).
- [/packages/foam-mcp](https://github.com/foambubble/foam/tree/main/packages/foam-mcp) - Model Context Protocol server library (`@foam/mcp`) that exposes the Foam knowledge graph to AI agents.

#### @foam/core

Platform-agnostic core logic shared by the extension, CLI, and any future surface. Must remain free of any dependency on the `vscode` library and on Node's `path` module (it also runs in the browser and React Native).

#### @foam/mcp

Library that exposes Foam's knowledge graph over the [Model Context Protocol](https://modelcontextprotocol.io/) so AI agents can query the workspace. Depends on `@foam/core` and must remain free of any `vscode` dependency.

#### @foam/graph-view

The graph webview is a Lit web component bundled for use in the VS Code extension. Key points:

- `src/protocol.ts` owns the message contract between the extension host and the webview. The extension imports from `@foam/graph-view/protocol`.
- `packages/foam-vscode/static/dataviz/` is build output (gitignored) — the source lives in `packages/foam-graph/src/`.
- Build and test commands: `yarn workspace @foam/graph-view build` / `yarn workspace @foam/graph-view test`.

### Testing

Code needs to come with tests.
We use the following convention in Foam:

- `*.test.ts` are unit tests (Vitest, no VS Code dependency)
- `*.spec.ts` are integration tests (need the VS Code extension host; those marked `/* @unit-ready */` also run against a mock)

Tests live alongside the code in `src`.

`yarn test:unit` from the repo root is the fast loop. `yarn test` runs everything CI runs, including the slow VS Code host tests. When fixing a bug, write the failing test first and confirm it fails before implementing the fix. See [testing conventions](docs/dev/testing-conventions.md) for the full picture.

### The VS Code Extension

This guide assumes you read the previous instructions and you're set up to work on Foam.

1. Now we'll use the launch configuration defined at [`.vscode/launch.json`](https://github.com/foambubble/foam/blob/main/.vscode/launch.json) to start a new extension host of VS Code. Open the "Run and Debug" Activity (the icon with the bug on the far left) and select "Run VSCode Extension" in the pop-up menu. Now hit F5 or click the green arrow "play" button to fire up a new copy of VS Code with your extension installed.

2. In the new extension host of VS Code that launched, open a Foam workspace (e.g. your personal one, or a test-specific one created from [foam-template](https://github.com/foambubble/foam-template)).

3. Test a command to make sure it's working as expected. Open the Command Palette (Ctrl/Cmd + Shift + P) and select "Foam: Update Markdown Reference List". If you see no errors, it's good to go!

### Working with an AI coding agent

Claude Code, Codex, Cursor, and similar tools pick up [AGENTS.md](AGENTS.md) automatically (Claude Code reads [CLAUDE.md](CLAUDE.md), which includes it and adds a few Claude-specific notes). A few things to know:

- You are responsible for what your agent produces. Read the diff, run the tests, and make sure the change is the smallest one that covers the behavior.
- The guidance tells agents not to push, open PRs, or comment on GitHub. Pushing and opening the PR is your job.
- `.agent/current-plan.md` and `.agent/tasks/` are gitignored scratch space where agents keep plans and issue research.
- Larger changes start from a spec: a short document in `specs/<slug>/` saying what the change is and how we will know it works, reviewed before the code is written. See [specs/README.md](specs/README.md).

### What reviewers look for

- The smallest change that covers the behavior. No speculative generality, no UI nobody asked for.
- Bug fixes come with a test that failed before the fix.
- Domain logic stays separate from VS Code bindings. `@foam/core` has no `vscode` or Node `path` imports.
- Domain code passes `URI`s around; path strings appear only at I/O boundaries.
- A changeset when a published package changes. A `@foam/core` change also lists `foam-vscode` and `@foam/cli`, because they bundle core and Changesets won't bump them for you. See [releasing Foam](docs/dev/releasing-foam.md).
- Foam vocabulary: "workspace", never "vault".
- `yarn lint` is clean (the pre-push hook runs it) and the code is formatted with Prettier (`yarn format`).

### Submitting a Pull Request (PR)

After you have made your changes to your copy of the project, it is time to try and merge those changes into the public community project.

1. Return to the project's [home repository page](https://github.com/foambubble/foam).
2. GitHub should show you a button called "Compare & pull request" linking your forked repository to the community repository.
3. Click that button and confirm that your repository is going to be merged into the community repository. See [this guide](https://blog.robsewell.com/blog/how-to-fork-a-github-repository-and-contribute-to-an-open-source-project/) for more specifics.
4. Add as many relevant details to the PR message to make it clear to the project maintainers and other members of the community what you have accomplished with your new changes. Link to any issues the changes are related to.
   - If your change affects users of any published package (extension, CLI, or `@foam/core`), include a changeset in the PR. Run `yarn changeset` from the repo root, pick the affected packages and bump type, and commit the generated `.changeset/*.md` file alongside your code. The accumulated changesets become the next release's CHANGELOG entries when a maintainer runs `yarn version-packages`.
5. Your PR will then need to be reviewed and accepted by the other members of the community. Any discussion about the changes will occur in your PR thread.
6. Once reviewed and accepted you can complete the merge request!
7. Finally rest and watch the sun rise on a grateful universe... Or start tackling the other open issues ;)

---

Feel free to modify and submit a PR if this guide is out-of-date or contains errors!
