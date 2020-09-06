# GistPad

[GistPad](https://aka.ms/gistpad) is a Visual Studio Code extension that allows you to edit your GitHub gists and repos, without needing to clone anything locally. It provides support for editing Foam workspaces, complete with `[[link]]` [completion/navigation](https://github.com/vsls-contrib/gistpad#links), [daily pages](https://github.com/vsls-contrib/gistpad#daily-pages), [pasting images](https://github.com/vsls-contrib/gistpad#pasting-images-1) and [backlinks](https://github.com/vsls-contrib/gistpad#backlinks). If you'd like to persist your notes in a GitHub repository, and automatically sync changes without needing to manually commit/push/pull, then GistPad might be an option worth exploring.

<img width="700px" src="https://user-images.githubusercontent.com/116461/87234714-96ba9400-c388-11ea-92c3-544d9a3bb633.png" />

## Getting started

To start using GistPad for your Foam-based knowledge base, simply perform the following steps:

1. Download the [GistPad extension](https://aka.ms/gistpad) and then re-start Visual Studio Code

1. Run the `GistPad: Sign In` command, and provide a [GitHub token](https://github.com/settings/tokens/new) that includes the `repo` scope (and optionally `gist` and `delete_repo` scope, if you'd like to use GistPad for managing your GitHub content more holistically)

1. Run the `GistPad: Manage Repository` command and select the `Create repo from template...` or `Create private repo from template...` depending on your preference

1. Select the `Foam-style wiki` template, and then specify a name for your Foam workspace (e.g. `my-foam-notes`, `johns-knowledge-base`)

Your new repo will be created in your GitHub account, and the `Foam` welcome page will be automatically opened. If you already have an existing Foam workspace in GitHub, then when you run step #3 above, simply select or specify the name of the GitHub repository instead.

> Note: If you have any and all feedback on how GistPad can be improved to support your Foam workflow, please don't hesitate to [let us know](https://github.com/vsls-contrib/gistpad)! 👍

<img width="700px" src="https://user-images.githubusercontent.com/116461/87863222-c1b76180-c90d-11ea-87d9-04bee1c58a0d.png" />

## Managing your workspace

Once you've opened/created the Foam repository, it will appear in the `Repositories` view of the `GistPad` tab (the one with the little notebook icon). From this tree view, you can add/edit/delete/rename new pages, upload local files, as well as view the backlinks for each page (they appear as child notes of a page).

<img width="250px" src="https://user-images.githubusercontent.com/116461/87234704-83a7c400-c388-11ea-90a8-2a660bef4dc5.png" />

## Editing your workspace

When you create or open a page, you can edit the markdown content as usual, as well as [paste images](https://github.com/vsls-contrib/gistpad#pasting-images-1), and create [`[[links]]` to other pages](https://github.com/vsls-contrib/gistpad#links). When you type `[[`, you'll recieve auto-completion for the existing pages in your workspace, and you can also automatically create new pages by simply creating a link to it.

Since you're using the Visual Studio Code markdown editor, you can benefit from all of the rich language services (e.g. syntax highlighting, header collapsing), as well as the extension ecosystem (e.g. [Emojisense](https://marketplace.visualstudio.com/items?itemName=bierner.emojisense)).

## Navigating your workspace

When editing a file, you can easily navigate `[[links]]` by hovering over them to see a preview of their contents and/or `cmd+clicking` on them in order to jump to the respective page. Furthermore, when you add a link to a page, a [backlink](https://github.com/vsls-contrib/gistpad#backlinks) is automatically added to it.

You can view a page's backlinks using either of the following techniques:

1. Expanding the file's node in the `Repositories` tree, since it's child nodes will represent backlinks. This makes it easy to browse your pages and their backlinks in a single hierachical view.

1. Opening a file, and then viewing it's backlinks list at the bottom of the editor view. This makes it easy to read a page and then see its backlinks in a contextually rich way.

## Daily Pages

In addition to create arbitrary pages, you can also use GistPad for journaling or capturing [daily notes](https://github.com/vsls-contrib/gistpad#daily-pages). Simply click the calendar icon in the `Repositories` tree, which will open up the page that represents today. If the page doesn't already exist, then it will be created in the workspace before being opened.

<img width="700px" src="https://user-images.githubusercontent.com/116461/87234721-b356cc00-c388-11ea-946a-e7f9c92258a6.png" />
