# Using Dev Containers

Foam provides a [devcontainer](https://devcontainer.ai/) configuration to make it easy to contribute without installing Node and Yarn locally.

## Quick start

1. Install [VS Code](https://code.visualstudio.com/) and the [Dev Containers](https://aka.ms/vscode-remote/download/extension) extension.
2. Open the Foam repository in VS Code.
3. Run **Dev Containers: Reopen in Container** from the command palette.

This will build a Docker image with Node 18 and install dependencies using `yarn install`. Once ready you can run the usual build and test commands from the integrated terminal.


