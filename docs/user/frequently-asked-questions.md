# Frequently Asked Questions

- [Frequently Asked Questions](#frequently-asked-questions)
  - [Links/Graphs/BackLinks don't work. How do I enable them?](#linksgraphsbacklinks-dont-work-how-do-i-enable-them)
  - [I don't want Foam enabled for all my workspaces](#i-dont-want-foam-enabled-for-all-my-workspaces)
  - [I want to publish the graph view to GitHub pages or Vercel](#i-want-to-publish-the-graph-view-to-github-pages-or-vercel)
  - [Does Foam collect any data?](#does-foam-collect-any-data)

## Links/Graphs/BackLinks don't work. How do I enable them?

- Ensure that you have all the [[recommended-extensions]] installed in Visual Studio Code
- Reload Visual Studio Code by running `Cmd` + `Shift` + `P` (`Ctrl` + `Shift` + `P` for Windows), type "reload" and run the **Developer: Reload Window** command to for the updated extensions take effect
- Check the formatting rules for links on [[wikilinks]]

## I don't want Foam enabled for all my workspaces

Any extension you install in Visual Studio Code is enabled by default. Given the philosophy of Foam, it works out of the box without doing any configuration upfront. In case you want to disable Foam for a specific workspace, or disable Foam by default and enable it for specific workspaces, it is advised to follow the best practices as [documented by Visual Studio Code](https://code.visualstudio.com/docs/editor/extension-marketplace#_manage-extensions)

## I want to publish the graph view to GitHub pages or Vercel

If you want a different front-end look to your published foam and a way to see your graph view, we'd recommend checking out these templates:

- [foam-gatsby](https://github.com/mathieudutour/foam-gatsby-template) by [Mathieu Dutour](https://github.com/mathieudutour)
- [foam-gatsby-kb](https://github.com/hikerpig/foam-template-gatsby-kb) by [hikerpig](https://github.com/hikerpig)

## Does Foam collect any data?

Foam collects anonymous usage data (which commands are used, which features are configured) to help prioritize development. No note content, file names, or personal information is ever collected.

Foam follows VS Code's global telemetry setting (`telemetry.telemetryLevel`). If you have disabled telemetry in VS Code, Foam will not send any data.

To inspect what is being sent, set the Foam log level to `Debug` (run `Foam: Set log level` from the command palette) — telemetry events will appear in the Foam output channel. See [[foam-logging-in-vscode]] for details.

See [[telemetry]] for the full list of collected data and opt-out instructions.

[recommended-extensions]: getting-started/recommended-extensions.md 'Recommended Extensions'
[wikilinks]: features/wikilinks.md 'Wikilinks'
[telemetry]: tools/telemetry.md 'Telemetry'
[foam-logging-in-vscode]: tools/foam-logging-in-vscode.md 'Foam logging in VsCode'
