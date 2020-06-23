# Foam

> _When you want to build a second brain, but you also want to own your own brain._

**Foam** is a personal knowledge management and sharing system inspired by [Roam Research](https://roamresearch.com/), built on [Visual Studio Code](https://code.visualstudio.com/) and [GitHub](https://github.com/).

You can use **Foam** for organising your research, keeping re-discoverable notes, writing long-form content and, optionally, publishing it to the web.

**Foam** is free, open source, and extremely extensible to suit your personal workflow. You own the information you create with Foam, and you're free to share it and collaborate on it with anyone you want.

Fun fact: This documentation was researched, written and published using **Foam**.

## Table of Contents

- [Foam](#foam)
  - [Table of Contents](#table-of-contents)
  - [How do I use Foam?](#how-do-i-use-foam)
  - [What's in a Foam?](#whats-in-a-foam)
  - [Features](#features)
  - [Getting started](#getting-started)
  - [Future plans](#future-plans)
  - [Thanks and attribution](#thanks-and-attribution)
  - [License](#license)

## How do I use Foam?

**Foam** is a tool that supports creating relationships between thoughts and information to help you think better.

![Short video of Foam in use](assets/images/readme-demo.gif).

Whether you want to build a [Second Brain](https://www.buildingasecondbrain.com/) or a [Zettelkasten](https://zettelkasten.de/posts/overview/), write a book, or just get better at long-term learning, **Foam** can help you organise your thoughts if you follow these simple rules and tools:

1. [Create a single **Foam** workspace](https://github.com/foambubble/foam-template/generate) for all your knowledge and research.
2. Write your thoughts in markdown documents (I like to call them **Bubbles**, but that might be more than a little twee). These documents should be atomic: Put things that belong together into a single document, and limit its content to that single topic. ([source](https://zettelkasten.de/posts/overview/#principles))
3. Use Foam's shortcuts and autocompletions to link your thoughts together with `[[wiki-links]]`, and navigate between them to explore your knowledge graph.
4. Explore your **Foam** workspace using a [[graph-visualisation]], and discover relationships betweeh your thoughts with the use of [[backlinking]].

Foam is a like a bathtub: _What you get out of it depends on what you put into it._

## What's in a Foam?

Like the soapy suds it's named after, **Foam** is mostly air.

1. The editing experience of **Foam** is powered by VS Code, enhanced by workspace settings that glue together recommended Code Extensions and preferences optimised for writing and navigating information.
2. To back up, collaborate on and share your content between devices, Foam pairs well with [GitHub](http://github.com/).
3. To publish your content, you can set it up to publish to GitHub pages with zero code and zero config, or to any website hosting platform like [Netlify](http://netlify.com/) or [Vercel](vercel).

## Features

**Foam** doesn't have features in the traditional sense. Out of the box, you have access to all features of VS Code and all the [[recommended-extensions]] you choose to install, but it's up to you to discover what you can do with it!

**Foam** is currently about "10% ready" compared to all the features I've thoughts of, but I've only thought of ~1% of the features it could have.

- Head over to [[recipes]] for some useful patterns and ideas
- Check out [[roadmap]] to see what's in the plans

## Getting started

> ⚠️ Foam is still in preview. Expect the first use experience to be a little rough.

These instructions assume you have a GitHub account, and you have Visual Studio Code installed.

1. [Create a GitHub repository from foam-template](https://github.com/foambubble/foam-template/generate). If you want to keep your thoughts to yourself, remember to set the repository private.
2. Clone the repository and open it in VS Code.
3. When prompted to install recommended extensions, click **Install all** (or **Show Recommendations** if you want to review and install them one by one)

After setting up the repository, open [.vscode/settings.json](.vscode/settings.json) and edit, add or remove any settings you'd like for your Foam workspace.

To learn more about how to use **Foam**, read the [[recipes]].

## Future plans

The current version of Foam is essentially a highly functional prototype. I am using it as my personal thinking tool in order to learn how to best use it, and I hope others will too.

See:

- [[roadmap]] for current plans
- [[principles]] to understand Foam's philosophy and direction
- [[contribution-guide]] guide to learn how to participate.

Feel free to open [GitHub issues](https://github.com/foambubble/foam/issues) to give us feedback and ideas for new features.

## Thanks and attribution

**Foam** is built by [Jani Eväkallio](https://github.com/jevakallio) ([@jevakallio](https://twitter.com/jevakallio)).

**Foam** was inspired by [Roam Research](https://roamresearch.com/) and the [Zettelkasten methodology](https://zettelkasten.de/posts/overview)

**Foam** wouldn't be possible without [Visual Studio Code](https://code.visualstudio.com/) and [GitHub](https://github.com/), and relies heavily on these fantastic open source extensions and all their contributors:

- [Markdown Notes](https://marketplace.visualstudio.com/items?itemName=kortina.vscode-markdown-notes)
- [Markdown Links](https://marketplace.visualstudio.com/items?itemName=tchayen.markdown-links)
- [Markdown All In One](https://marketplace.visualstudio.com/items?itemName=yzhang.markdown-all-in-one)
- [Git Lens](https://marketplace.visualstudio.com/items?itemName=eamodio.gitlens)
- [Git Automator](https://marketplace.visualstudio.com/items?itemName=ivangabriele.vscode-git-add-and-commit)

## License

Foam is licensed under the [MIT license](license).

[//begin]: # "Autogenerated link references for markdown compatibility"
[wiki-links]: wiki-links "Wiki Links"
[graph-visualisation]: graph-visualisation "Graph visualisation"
[backlinking]: backlinking "Backlinking"
[recommended-extensions]: recommended-extensions "Recommended Extensions"
[recipes]: recipes "Recipes"
[roadmap]: roadmap "Roadmap"
[principles]: principles "Principles"
[contribution-guide]: contribution-guide "Contribution Guide"
[//end]: # "Autogenerated link references"