# Frequently Asked Questions

> ⚠️ Foam is still in preview. Expect the experience to be a little rough.

- [Frequently Asked Questions](#frequently-asked-questions)
  - [Links/Graphs/BackLinks don't work. How do I enable them?](#linksgraphsbacklinks-dont-work-how-do-i-enable-them)
  - [I don't want Foam enabled for all my workspaces](#i-dont-want-foam-enabled-for-all-my-workspaces)
  - [I want to publish the graph view to GitHub pages or Vercel](#i-want-to-publish-the-graph-view-to-github-pages-or-vercel)

## Links/Graphs/BackLinks don't work. How do I enable them?

- Ensure that you have all the [[recommended-extensions]] installed in Visual Studio Code
- Reload Visual Studio Code by running `Cmd` + `Shift` + `P` (`Ctrl` + `Shift` + `P` for Windows), type "reload" and run the **Developer: Reload Window** command to for the updated extensions take effect
- Check the formatting rules for links on [[foam-file-format]] and [[wikilinks]]

## I don't want Foam enabled for all my workspaces

Any extension you install in Visual Studio Code is enabled by default. Given the philosophy of Foam, it works out of the box without doing any configuration upfront. In case you want to disable Foam for a specific workspace, or disable Foam by default and enable it for specific workspaces, it is advised to follow the best practices as [documented by Visual Studio Code](https://code.visualstudio.com/docs/editor/extension-marketplace#_manage-extensions)

## I want to publish the graph view to GitHub pages or Vercel

If you want a different front-end look to your published foam and a way to see your graph view, we'd recommend checking out these templates:

- [foam-gatsby](https://github.com/mathieudutour/foam-gatsby-template) by [Mathieu Dutour](https://github.com/mathieudutour)
- [foam-gatsby-kb](https://github.com/hikerpig/foam-template-gatsby-kb) by [hikerpig](https://github.com/hikerpig)

[recommended-extensions]: getting-started/recommended-extensions.md 'Recommended Extensions'
[foam-file-format]: ../dev/foam-file-format.md 'Foam File Format'
[wikilinks]: features/wikilinks.md 'Wikilinks'
