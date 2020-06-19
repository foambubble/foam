# Foam

 > _When you want to build a second brain, and you also want to own your own brain._
  
**Foam** is a personal knowledge management and sharing system inspired by [Roam Research](https://roamresearch.com/), built on [Visual Studio Code](https://code.visualstudio.com/) and [GitHub](https://github.com/).

You can use **Foam** for organising research, taking notes, writing long-form content and publishing it to the web (or keeping it private, if you prefer). You can use it to build a [second brain](https://www.buildingasecondbrain.com/) or a [Zettelkasten](https://zettelkasten.de/posts/overview/).

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

## What's in a Foam?

Like the soapy suds it's named after, **Foam** is mostly air. The current version of Foam was created with **zero lines of code**, built instead on the shoulders of giants.

The core of **Foam** is an opinionated VS Code [workspace settings file](.vscode/settings.json) that glues together recommended Code Extensions, custom settings and key bindings, optimised for writing and navigating information.

Foam helps you to:

- Write rich markdown documents
- Create links between documents with the help of auto-complete
- Navigate between linked documents with a single click
- Generate tables of content and update them automatically
- Easily create and manage lists and check lists
- Keep track of the context and evolution of your thoughts by bringing.
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

**Foam** implements many ([but not all](roam_comparison.md)) of Roam's features inside VS Code, providing access to:

- Full power of VS Code, such as
  - Powerful keyboard navigation (or even [vim mode](https://marketplace.visualstudio.com/items?itemName=vscodevim.vim))
  - Multiple windows, tabs and panes
  - Embed executable code to your Bubbles with CodeRunner or Jupyter Notebooks
  - Snippets, macros, 
  - If there's an [extension](https://marketplace.visualstudio.com/vscode) for it, you can use it.
- Free, low lock-in hosting in any Git repository
  - Keep history or the evolution of your thoughts
  - Store any type of file to your knowledge base
  - Host entire websites and web apps inside of your published Foam site!
- Ability to customise everything about your environment (colors, fonts, keyboard shortcuts, etc.)

## Features

**Foam** doesn't have features in the traditional sense. Out of the box, you have access to all features of VS Code and all the [recommended extensions](#thanks-and-attribution) you choose to install, but it's up to you to discover what you can do with it!

Head over to [Recipes](recipes.md) for some useful patterns and ideas, and [contribute your own tips](contributing.md)!

## Getting started

1. [Install VS Code](https://code.visualstudio.com/) (available on Linux, Mac and Windows)

## Future plans

In order to implement a [further features](roam_comparison.md) like back links and unlinked references, it may be necessary to implement our own VS Code extension, syntax and language server.

Read our [Contibuting guide](contributing.md) for how to help improve Foam.

## Thanks and attribution

**Foam** is built by [Jani Eväkallio](https://github.com/jevakallio) ([@jevakallio](https://twitter.com/jevakallio)) and [all contributors](https://github.com/jevakallio/Foam/graphs/contributors).

**Foam** was inspired by [Roam Research](https://roamresearch.com/).

**Foam** wouldn't be possible without [Visual Studio Code](https://code.visualstudio.com/) and [GitHub](https://github.com/), and relies heavily on these fantastic open source extensions and all their contributors:
- [Git Lens](https://marketplace.visualstudio.com/items?itemName=eamodio.gitlens)
- [Git Automator](https://marketplace.visualstudio.com/items?itemName=ivangabriele.vscode-git-add-and-commit)
- [Markdown All In One](https://marketplace.visualstudio.com/items?itemName=yzhang.markdown-all-in-one)