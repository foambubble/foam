# Tutorial: Adding a New Command to the VS Code Extension

This tutorial will walk you through adding a new command to the VS Code extension.

Let's try adding a new command to `foam-vscode`.
1. Navigate to `packages/foam-vscode/src/extension.ts`
2. Find the `activate` function
3. Register a new command:

```diff
export function activate(context: ExtensionContext) {
  context.subscriptions.push(
    commands.registerCommand(
      "foam-vscode.update-wikilinks",
      updateReferenceList
    ),
+   commands.registerCommand(
+     "foam-vscode.hello-friend",
+     () => {
+ .     window.showInformationMessage("Hello, friend!);
+     }
+   ),
    workspace.onWillSaveTextDocument(onWillSave),
    languages.registerCodeLensProvider(
      mdDocSelector,
      new WikilinkReferenceCodeLensProvider()
    )
  );
}

```
4. Navigate to `packages/foam-vscode/package.json`
5. Add your command to the `contributes.commands` array:

```diff
"contributes": {
    "commands": [
      {
        "command": "foam-vscode.update-wikilinks",
        "title": "Foam: Update Markdown Reference List"
+     },
+     {
+       "command": "foam-vscode.hello-friend",
+       "title": "Foam: Hello Friend",
+     },
    ]
  },
```
6. Press f5 to run the new extension host, or restart the extension host if it's already running.
7. Test out your new command. Open the Command Palette (Ctrl/Cmd + Shift + P) and select "Foam: Hello Friend". You should see an information pop up in the corner of the screen.

And that's how you add new commands! We look forward to your contributions.

More resources:
- [Your First Extension](https://code.visualstudio.com/api/get-started/your-first-extension)
- [`vscode-extension-samples`](https://github.com/microsoft/vscode-extension-samples)

### F.A.Q.

**How do I write a test for my extension addition?**

This is still a work in progress. We've opted for [Jest](https://jestjs.io/) as our testing framework. There are currently no end-to-end tests (contributions are welcome!). However, we would encourage you to write tests for anything that you can test. We're happy to discuss on PRs too!

**How do I know if using the local version of the Foam extension vs. the produciton one while testing locally?**

When you start the extension development host, the local version of the extension "shadows" or overrides any installed versions of the package with the same ID. So when you F5/start the extension host, you should always be running the local version, plus any other extensions your workspace/vscode is configured to run.

As far as we know, you can't run the "shadowed" base install while running the local extension
