---
tags: todo, good-first-task
---

# Contribution Guide

Foam is open to contributions of any kind, including but not limited to code, documentation, ideas, and feedback.
This guide aims to help guide new and seasoned contributors getting around the Foam codebase. For a comprehensive guide about contributing to open-source projects in general, [see here](https://blog.robsewell.com/blog/how-to-fork-a-github-repository-and-contribute-to-an-open-source-project/).

## Getting Up To Speed

Before you start contributing we recommend that you read the following links:

- [[principles]] - This document describes the guiding principles behind Foam.
- [[code-of-conduct]] - Rules we hope every contributor aims to follow, allowing everyone to participate in our community!

To get yourself familiar with the codebase you can also browse [this repo](https://app.komment.ai/wiki/github/foambubble/foam)

## Diving In

We understand that diving in an unfamiliar codebase may seem scary,
to make it easier for new contributors we provide some resources:

You can also see [existing issues](https://github.com/foambubble/foam/issues) and help out!
Finally, the easiest way to help, is to use it and provide feedback by [submitting issues](https://github.com/foambubble/foam/issues/new/choose) or participating in the [Foam Community Discord](https://foambubble.github.io/join-discord/g)!

## Contributing

If you're interested in contributing, this short guide will help you get things set up locally (assuming [node.js >= v18](https://nodejs.org/) and [yarn](https://yarnpkg.com/) are already installed on your system).
You can also use the provided [[devcontainers]] to avoid installing dependencies locally. With the Dev Containers extension installed, open the repository in VS Code and run **Dev Containers: Reopen in Container**.

1. Fork the project to your Github account by clicking the "Fork" button on the top right hand corner of the project's [home repository page](https://github.com/foambubble/foam).
2. Clone your newly forked repo locally:

   `git clone https://github.com/your_username/foam.git`

3. Install the necessary dependencies by running this command from the root of the cloned repository:

   `yarn install`

4. From the repository root, run the command:

   `yarn build`

You should now be ready to start working!

### Structure of the project

Foam code and documentation live in the monorepo at [foambubble/foam](https://github.com/foambubble/foam/).

- [/docs](https://github.com/foambubble/foam/tree/main/docs): documentation and [[recipes]].

Exceptions to the monorepo are:

- The starter template at [foambubble/foam-template](https://github.com/foambubble/)
- All other [[recommended-extensions]] live in their respective GitHub repos

This project uses [Yarn workspaces](https://classic.yarnpkg.com/en/docs/workspaces/).

Originally Foam had:

- [/packages/foam-core](https://github.com/foambubble/foam/tree/ee7a8919761f168d3931079adf21c5ad4d63db59/packages/foam-core) - Powers the core functionality in Foam across all platforms.
- [/packages/foam-vscode](https://github.com/foambubble/foam/tree/main/packages/foam-vscode) - The core VS Code plugin.

To improve DX we have moved the `foam-core` module into `packages/foam-vscode/src/core`, but from a development point of view it's useful to think of the `foam-vscode/src/core` "submodule" as something that might be extracted in the future.

For all intents and purposes this means two things:

1. nothing in `foam-vscode/src/core` should depend on files outside of this directory
2. code in `foam-vscode/src/core` should NOT depend on `vscode` library

We have kept the yarn workspace for the time being as we might use it to pull out `foam-core` in the future, or we might need it for other packages that the VS Code plugin could depend upon (e.g. currently the graph visualization is inside the module, but it might be pulled out if its complexity increases).

### Testing

Code needs to come with tests.
We use the following convention in Foam:

- `*.test.ts` are unit tests
- `*.spec.ts` are integration tests

Tests live alongside the code in `src`.

### The VS Code Extension

This guide assumes you read the previous instructions and you're set up to work on Foam.

1. Now we'll use the launch configuration defined at [`.vscode/launch.json`](https://github.com/foambubble/foam/blob/main/.vscode/launch.json) to start a new extension host of VS Code. Open the "Run and Debug" Activity (the icon with the bug on the far left) and select "Run VSCode Extension" in the pop-up menu. Now hit F5 or click the green arrow "play" button to fire up a new copy of VS Code with your extension installed.

2. In the new extension host of VS Code that launched, open a Foam workspace (e.g. your personal one, or a test-specific one created from [foam-template](https://github.com/foambubble/foam-template)).

3. Test a command to make sure it's working as expected. Open the Command Palette (Ctrl/Cmd + Shift + P) and select "Foam: Update Markdown Reference List". If you see no errors, it's good to go!

### Submitting a Pull Request (PR)

After you have made your changes to your copy of the project, it is time to try and merge those changes into the public community project.

1. Return to the project's [home repository page](https://github.com/foambubble/foam).
2. Github should show you an button called "Compare & pull request" linking your forked repository to the community repository.
3. Click that button and confirm that your repository is going to be merged into the community repository. See [this guide](https://blog.robsewell.com/blog/how-to-fork-a-github-repository-and-contribute-to-an-open-source-project/) for more specifics.
4. Add as many relevant details to the PR message to make it clear to the project maintainers and other members of the community what you have accomplished with your new changes. Link to any issues the changes are related to.
5. Your PR will then need to be reviewed and accepted by the other members of the community. Any discussion about the changes will occur in your PR thread.
6. Once reviewed and accept you can complete the merge request!
7. Finally rest and watch the sun rise on a grateful universe... Or start tackling the other open issues ;)

---

Feel free to modify and submit a PR if this guide is out-of-date or contains errors!

---

[//begin]: # "Autogenerated link references for markdown compatibility"
[principles]: ../principles.md "Principles"
[code-of-conduct]: code-of-conduct.md "Code of Conduct"
[devcontainers]: devcontainers.md "Using Dev Containers"
[recipes]: ../user/recipes/recipes.md "Recipes"
[recommended-extensions]: ../user/getting-started/recommended-extensions.md "Recommended Extensions"
[//end]: # "Autogenerated link references"
