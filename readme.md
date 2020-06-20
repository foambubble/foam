# Foam

 > _When you want to build a second brain, but you also want to own your own brain._
  
**Foam** is a personal knowledge management and sharing system inspired by [Roam Research](https://roamresearch.com/), built on [Visual Studio Code](https://code.visualstudio.com/) and [GitHub](https://github.com/).

You can use **Foam** for organising research, taking notes, writing long-form content and publishing it to the web (or keeping it private, if you prefer). 

**Foam** can help you whether you want to build a [second brain](https://www.buildingasecondbrain.com/) or a [Zettelkasten](https://zettelkasten.de/posts/overview/), or you just want to [GTD](https://gettingthingsdone.com/what-is-gtd/). Whether you're following a methodology or going with the flow, to get most of Foam, follow these rules:

1. Create a single **Foam** workspace for all your knowledge and research.
2. Write your thoughts in markdown documents (I like to call the **Bubbles**, but that might be more than a little twee). These documents should be atomic: Put things that belong together into a single document, and limit its content to that single topic. ([source](https://zettelkasten.de/posts/overview/#principles">https://zettelkasten.de/posts/overview/#principles))
3. Use Foam's shortcuts and autocompletions to link your thoughts together with Markdown links navigate between.

**Foam** is free, open source, and extremely extensible to suit your personal workflow. You own the information you create with Foam, and you're free to share it and collaborate on it with anyone you want.

Fun fact: This documentation was researched, written and published usign **Foam**.

## Table of Contents
- [Foam](#foam)
  - [Table of Contents](#table-of-contents)
  - [What's in a Foam?](#whats-in-a-foam)
  - [Why Foam instead of Roam?](#why-foam-instead-of-roam)
  - [Features](#features)
  - [Getting started](#getting-started)
  - [Future plans](#future-plans)
  - [Thanks and attribution](#thanks-and-attribution)
  - [License](#license)

## What's in a Foam?

Like the soapy suds it's named after, **Foam** is mostly air. The current version of Foam was created with **zero lines of code**, built instead on the shoulders of giants.

The core of **Foam** are VS Code workspace settings that glue together recommended Code Extensions, custom settings and key bindings, optimised for writing and navigating information.

Foam helps you to:

- Write rich markdown documents
- Create links between documents with the help of auto-complete
- Navigate between linked documents with a single click
- Generate tables of content and update them automatically
- Easily create and manage lists and check lists
- Keep track of the context and evolution of your thoughts by bring.
- Easily push code to a git repository

To back up, collaborate on and share your content between devices, Foam pairs well with [GitHub](http://github.com/). 

To publish your content, you can set it up to publish to GitHub pages with a single click, or any website hosting platform like [Netlify](http://netlify.com/) or [Vercel](vercel).

## Why Foam instead of Roam?

I've been using [Roam Research](https://roamresearch.com/) for a while, and I've been impressed by its ability to improve the quality and productivity of my thinking.

However, Roam comes with a few downsides:
- You don't own your own data (unless you keep backups).
- Roam is an early-stage startup, and I don't want to build my knowledge-gathering practices on something that may not be around in a few years.
- You're locked to paying $15/month for a tool that you're ideally using [for the rest of your life](https://zettelkasten.de/posts/how-many-zettelkasten/).
- As slick as it is, it can't compete with the customisability of VS Code.
- As of June 2020, the app is still slow, buggy and sometimes loses information when editing offline.

I built, and want to continue developing, **Foam** because I wanted to manage my personal knowledge repository using tools I feel the most comfortable with, while keeping the ownership of my own data. 

**Foam** implements many ([but not all](roam_comparison.md)) of Roam's features inside VS Code, providing access to:

- Full power of VS Code, such as
  - Powerful keyboard navigation (or even [vim mode](https://marketplace.visualstudio.com/items?itemName=vscodevim.vim))
  - Multiple windows, tabs and panes
  - Embed executable code to your Foam Bubbles with CodeRunner or Jupyter Notebooks
  - Snippets for common tasks
  - If there's an [extension](https://marketplace.visualstudio.com/vscode) for it, you can use it.
- Ability to customise everything about your environment (colors, fonts, keyboard shortcuts, etc.)
- Free, low lock-in hosting in any Git repository
  - Keep history or the evolution of your thoughts
  - Store any type of file to your knowledge base
  - Host entire websites and web apps inside of your published Foam site!
- Easy publishing workflow for sharing your knowledge with others.

## Features

**Foam** doesn't have features in the traditional sense. Out of the box, you have access to all features of VS Code and all the [recommended extensions](#thanks-and-attribution) you choose to install, but it's up to you to discover what you can do with it!

Head over to [Recipes](recipes.md) for some useful patterns and ideas, and [contribute your own tips](contributing.md)!

## Getting started

These instructions assume you have a GitHub account, and you have Visual Studio Code installed.

1. [Create a GitHub repository from foam-template](https://github.com/jevakallio/foam-template/generate)
2. Clone the repository and open it in VS Code
3. When prompted to install recommended extensions, click **Install all** (or **Show Recommendations** if you want to review and install them one by one)

After setting up the repository, open [.vscode/settings.json](.vscode/settings.json) and edit, add or remove any settings you'd like for your Foam workspace.

After making changes, sync the back to your git repository either:
- Using the GitLens UI
- Using GitAutomator commands
    - `Cmd`+`Shift`+`Z` to stage the current file and commit it, or
    - `Cmd`+`Shift`+`A` to stage all edited files and commit them, and finally
    - `Cmd`+`Shift`+`X` to push all commits
- Whatever way you prefer. It's your Foam!

To learn more about **Foam**, read the [Recipes](recipes.md).

## Future plans

The current version of Foam is essentially a functional prototype. I am using it as my personal thinking tool, and I hope others will too. 

However, it doesn't yet fully support the Zettelkasten method. In order to support [further features](roam_comparison.md) such as back links between Bubbles, it may be necessary to implement our own VS Code extension, syntax and language server.

Read our [Contibuting guide](contributing.md) for how to help improve Foam, and open [GitHub issues](https://github.com/jevakallio/foam/issues) to give us feedback and ideas for new features.

## Thanks and attribution

**Foam** is built by [Jani Eväkallio](https://github.com/jevakallio) ([@jevakallio](https://twitter.com/jevakallio)) and [all contributors](https://github.com/jevakallio/Foam/graphs/contributors).

**Foam** was inspired by [Roam Research](https://roamresearch.com/) and the [Zettelkasten methodology](https://zettelkasten.de/posts/overview)

**Foam** wouldn't be possible without [Visual Studio Code](https://code.visualstudio.com/) and [GitHub](https://github.com/), and relies heavily on these fantastic open source extensions and all their contributors:
- [Git Lens](https://marketplace.visualstudio.com/items?itemName=eamodio.gitlens)
- [Git Automator](https://marketplace.visualstudio.com/items?itemName=ivangabriele.vscode-git-add-and-commit)
- [Markdown All In One](https://marketplace.visualstudio.com/items?itemName=yzhang.markdown-all-in-one)

## License

Foam is licensed under the [MIT license](license).