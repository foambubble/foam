# Foam

**Foam** is a personal knowledge management and sharing system inspired by [Roam Research](https://roamresearch.com/), built on [Visual Studio Code](https://code.visualstudio.com/) and [GitHub](https://github.com/).

You can use **Foam** for organising your research, keeping re-discoverable notes, writing long-form content and, optionally, publishing it to the web.

**Foam** is free, open source, and extremely extensible to suit your personal workflow. You own the information you create with Foam, and you're free to share it, and collaborate on it with anyone you want.

<p class="announcement">
  <b>New!</b> Join <a href="https://foambubble.github.io/join-discord/w" target="_blank">Foam community Discord</a> for users and contributors!
</p>

<div class="website-only">
    <a class="github-button" href="https://github.com/foambubble/foam" data-icon="octicon-star" data-size="large" data-show-count="true" aria-label="Star foambubble/foam on GitHub">Star</a>
    <a class="github-button" href="https://github.com/foambubble/foam-template" data-icon="octicon-repo-template" data-size="large" aria-label="Use this template foambubble/foam-template on GitHub">Use this template</a>
</div>

## Table of Contents

- [Foam](#foam)
  - [Table of Contents](#table-of-contents)
  - [How do I use Foam?](#how-do-i-use-foam)
  - [What's in a Foam?](#whats-in-a-foam)
  - [Getting started](#getting-started)
  - [Features](#features)
  - [Call To Adventure](#call-to-adventure)
  - [Thanks and attribution](#thanks-and-attribution)
  - [License](#license)

## How do I use Foam?

**Foam** is a tool that supports creating relationships between thoughts and information to help you think better.

Whether you want to build a [Second Brain](https://www.buildingasecondbrain.com/) or a [Zettelkasten](https://zettelkasten.de/posts/overview/), write a book, or just get better at long-term learning, **Foam** can help you organise your thoughts if you follow these simple rules:

1. Create a single **Foam** workspace for all your knowledge and research following the [Getting started](#getting-started) guide.
2. Write your thoughts in markdown documents (I like to call them **Bubbles**, but that might be more than a little twee). These documents should be atomic: Put things that belong together into a single document, and limit its content to that single topic. ([source](https://zettelkasten.de/posts/overview/#principles))
3. Use Foam's shortcuts and autocompletions to link your thoughts together with `[[wikilinks]]`, and navigate between them to explore your knowledge graph.
4. Get an overview of your **Foam** workspace using a [[graph-visualization]] (⚠️ WIP), and discover relationships between your thoughts with the use of [[backlinking]].

Foam is a like a bathtub: _What you get out of it depends on what you put into it._

## What's in a Foam?

Like the soapy suds it's named after, **Foam** is mostly air.

1. The editing experience of **Foam** is powered by VS Code, enhanced by workspace settings that glue together [[recommended-extensions]] and preferences optimised for writing and navigating information.
2. To back up, collaborate on and share your content between devices, Foam pairs well with [GitHub](http://github.com/).
3. To publish your content, you can set it up to publish to [GitHub Pages](https://pages.github.com/), or to any website hosting platform like [Netlify](http://netlify.com/) or [Vercel](https://vercel.com).

> **Fun fact**: This documentation was researched, written and published using **Foam**.

## Getting started

> ⚠️ Foam is still in preview. Expect the experience to be a little rough.

These instructions assume you have a GitHub account, and you have Visual Studio Code installed.

1. Use the [foam-template project](https://github.com/foambubble/foam-template) to generate a new repository. If you're logged into GitHub, you can just hit this button:

   <a class="github-button" href="https://github.com/foambubble/foam-template/generate" data-icon="octicon-repo-template" data-size="large" aria-label="Use this template foambubble/foam-template on GitHub">Use this template</a>

   *If you want to keep your thoughts to yourself, remember to set the repository private, or if you don't want to use GitHub to host your workspace at all, choose [**Download as ZIP**](https://github.com/foambubble/foam-template/archive/master.zip) instead of **Use this template**.*

2. [Clone the repository locally](https://help.github.com/en/github/creating-cloning-and-archiving-repositories/cloning-a-repository) and open it in VS Code.

   *Open the repository as a folder using the `File > Open...` menu item. In VS Code, "open workspace" refers to [multi-root workspaces](https://code.visualstudio.com/docs/editor/multi-root-workspaces).*

3. When prompted to install recommended extensions, click **Install all** (or **Show Recommendations** if you want to review and install them one by one)

After setting up the repository, open `.vscode/settings.json` and edit, add or remove any settings you'd like for your Foam workspace.

* *If using a [multi-root workspace](https://code.visualstudio.com/docs/editor/multi-root-workspaces) as noted above, make sure that your **Foam** directory is first in the list. There are some settings that will need to be migrated from `.vscode/settings.json` to your `.code-workspace` file.*

To learn more about how to use **Foam**, read the [[recipes]].

Getting stuck in the setup? Read the [[frequently-asked-questions]].

Check our [issues on GitHub](http://github.com/foambubble/foam/issues) if you get stuck on something, and create a new one if something doesn't seem right!

## Features

**Foam** doesn't have features in the traditional sense. Out of the box, you have access to all features of VS Code and all the [[recommended-extensions]] you choose to install, but it's up to you to discover what you can do with it!

![Short video of Foam in use](assets/images/foam-navigation-demo.gif)

Head over to [[recipes]] for some useful patterns and ideas!

## Call To Adventure

The goal of **Foam** is to be your personal companion on your quest for knowledge.

It's currently about "10% ready" relative to all the features I've thought of, but I've only thought of ~1% of the features it could have, and I'm excited to learn from others.

I am using it as my personal thinking tool. By making it public, I hope to learn from others not only how to improve Foam, but also to improve how I learn and manage information.

If that sounds like something you're interested in, I'd love to have you along on the journey.

- Read about our [[principles]] to understand Foam's philosophy and direction
- Read the [[contribution-guide]] guide to learn how to participate.
- Feel free to open [GitHub issues](https://github.com/foambubble/foam/issues) to give me feedback and ideas for new features.

## Thanks and attribution

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://jevakallio.dev/"><img src="https://avatars1.githubusercontent.com/u/1203949?v=4?s=60" width="60px;" alt="Jani Eväkallio"/><br /><sub><b>Jani Eväkallio</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=jevakallio" title="Code">💻</a> <a href="https://github.com/foambubble/foam/commits?author=jevakallio" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://joeprevite.com/"><img src="https://avatars3.githubusercontent.com/u/3806031?v=4?s=60" width="60px;" alt="Joe Previte"/><br /><sub><b>Joe Previte</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=jsjoeio" title="Code">💻</a> <a href="https://github.com/foambubble/foam/commits?author=jsjoeio" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/riccardoferretti"><img src="https://avatars3.githubusercontent.com/u/457005?v=4?s=60" width="60px;" alt="Riccardo"/><br /><sub><b>Riccardo</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=riccardoferretti" title="Code">💻</a> <a href="https://github.com/foambubble/foam/commits?author=riccardoferretti" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://ojanaho.com/"><img src="https://avatars0.githubusercontent.com/u/2180090?v=4?s=60" width="60px;" alt="Janne Ojanaho"/><br /><sub><b>Janne Ojanaho</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=jojanaho" title="Code">💻</a> <a href="https://github.com/foambubble/foam/commits?author=jojanaho" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://bypaulshen.com/"><img src="https://avatars3.githubusercontent.com/u/2266187?v=4?s=60" width="60px;" alt="Paul Shen"/><br /><sub><b>Paul Shen</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=paulshen" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/coffenbacher"><img src="https://avatars0.githubusercontent.com/u/245867?v=4?s=60" width="60px;" alt="coffenbacher"/><br /><sub><b>coffenbacher</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=coffenbacher" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://mathieu.dutour.me/"><img src="https://avatars2.githubusercontent.com/u/3254314?v=4?s=60" width="60px;" alt="Mathieu Dutour"/><br /><sub><b>Mathieu Dutour</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=mathieudutour" title="Documentation">📖</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/presidentelect"><img src="https://avatars2.githubusercontent.com/u/1242300?v=4?s=60" width="60px;" alt="Michael Hansen"/><br /><sub><b>Michael Hansen</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=presidentelect" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://klickverbot.at/"><img src="https://avatars1.githubusercontent.com/u/19335?v=4?s=60" width="60px;" alt="David Nadlinger"/><br /><sub><b>David Nadlinger</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=dnadlinger" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://pluckd.co/"><img src="https://avatars2.githubusercontent.com/u/20598571?v=4?s=60" width="60px;" alt="Fernando"/><br /><sub><b>Fernando</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=MrCordeiro" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/jfgonzalez7"><img src="https://avatars3.githubusercontent.com/u/58857736?v=4?s=60" width="60px;" alt="Juan Gonzalez"/><br /><sub><b>Juan Gonzalez</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=jfgonzalez7" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://www.louiechristie.com/"><img src="https://avatars1.githubusercontent.com/u/6807448?v=4?s=60" width="60px;" alt="Louie Christie"/><br /><sub><b>Louie Christie</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=louiechristie" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://supersandro.de/"><img src="https://avatars2.githubusercontent.com/u/7258858?v=4?s=60" width="60px;" alt="Sandro"/><br /><sub><b>Sandro</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=SuperSandro2000" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Skn0tt"><img src="https://avatars1.githubusercontent.com/u/14912729?v=4?s=60" width="60px;" alt="Simon Knott"/><br /><sub><b>Simon Knott</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=Skn0tt" title="Documentation">📖</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://styfle.dev/"><img src="https://avatars1.githubusercontent.com/u/229881?v=4?s=60" width="60px;" alt="Steven"/><br /><sub><b>Steven</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=styfle" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Georift"><img src="https://avatars2.githubusercontent.com/u/859430?v=4?s=60" width="60px;" alt="Tim"/><br /><sub><b>Tim</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=Georift" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/sauravkhdoolia"><img src="https://avatars1.githubusercontent.com/u/34188267?v=4?s=60" width="60px;" alt="Saurav Khdoolia"/><br /><sub><b>Saurav Khdoolia</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=sauravkhdoolia" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://anku.netlify.com/"><img src="https://avatars1.githubusercontent.com/u/22813027?v=4?s=60" width="60px;" alt="Ankit Tiwari"/><br /><sub><b>Ankit Tiwari</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=anku255" title="Documentation">📖</a> <a href="https://github.com/foambubble/foam/commits?author=anku255" title="Tests">⚠️</a> <a href="https://github.com/foambubble/foam/commits?author=anku255" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/ayushbaweja"><img src="https://avatars1.githubusercontent.com/u/44344063?v=4?s=60" width="60px;" alt="Ayush Baweja"/><br /><sub><b>Ayush Baweja</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=ayushbaweja" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/TaiChi-IO"><img src="https://avatars3.githubusercontent.com/u/65092992?v=4?s=60" width="60px;" alt="TaiChi-IO"/><br /><sub><b>TaiChi-IO</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=TaiChi-IO" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/juanfrank77"><img src="https://avatars1.githubusercontent.com/u/12146882?v=4?s=60" width="60px;" alt="Juan F Gonzalez "/><br /><sub><b>Juan F Gonzalez </b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=juanfrank77" title="Documentation">📖</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://sanketdg.github.io"><img src="https://avatars3.githubusercontent.com/u/8980971?v=4?s=60" width="60px;" alt="Sanket Dasgupta"/><br /><sub><b>Sanket Dasgupta</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=SanketDG" title="Documentation">📖</a> <a href="https://github.com/foambubble/foam/commits?author=SanketDG" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/nstafie"><img src="https://avatars1.githubusercontent.com/u/10801854?v=4?s=60" width="60px;" alt="Nicholas Stafie"/><br /><sub><b>Nicholas Stafie</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=nstafie" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/francishamel"><img src="https://avatars3.githubusercontent.com/u/36383308?v=4?s=60" width="60px;" alt="Francis Hamel"/><br /><sub><b>Francis Hamel</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=francishamel" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://digiguru.co.uk"><img src="https://avatars1.githubusercontent.com/u/619436?v=4?s=60" width="60px;" alt="digiguru"/><br /><sub><b>digiguru</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=digiguru" title="Code">💻</a> <a href="https://github.com/foambubble/foam/commits?author=digiguru" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/chirag-singhal"><img src="https://avatars3.githubusercontent.com/u/42653703?v=4?s=60" width="60px;" alt="CHIRAG SINGHAL"/><br /><sub><b>CHIRAG SINGHAL</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=chirag-singhal" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/lostintangent"><img src="https://avatars3.githubusercontent.com/u/116461?v=4?s=60" width="60px;" alt="Jonathan Carter"/><br /><sub><b>Jonathan Carter</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=lostintangent" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://www.synesthesia.co.uk"><img src="https://avatars3.githubusercontent.com/u/181399?v=4?s=60" width="60px;" alt="Julian Elve"/><br /><sub><b>Julian Elve</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=synesthesia" title="Documentation">📖</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/thomaskoppelaar"><img src="https://avatars3.githubusercontent.com/u/36331365?v=4?s=60" width="60px;" alt="Thomas Koppelaar"/><br /><sub><b>Thomas Koppelaar</b></sub></a><br /><a href="#question-thomaskoppelaar" title="Answering Questions">💬</a> <a href="https://github.com/foambubble/foam/commits?author=thomaskoppelaar" title="Code">💻</a> <a href="#userTesting-thomaskoppelaar" title="User Testing">📓</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://www.akshaymehra.com"><img src="https://avatars1.githubusercontent.com/u/8671497?v=4?s=60" width="60px;" alt="Akshay"/><br /><sub><b>Akshay</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=MehraAkshay" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://johnlindquist.com"><img src="https://avatars0.githubusercontent.com/u/36073?v=4?s=60" width="60px;" alt="John Lindquist"/><br /><sub><b>John Lindquist</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=johnlindquist" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://ashwin.run/"><img src="https://avatars2.githubusercontent.com/u/1689183?v=4?s=60" width="60px;" alt="Ashwin Ramaswami"/><br /><sub><b>Ashwin Ramaswami</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=epicfaace" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Klaudioz"><img src="https://avatars1.githubusercontent.com/u/632625?v=4?s=60" width="60px;" alt="Claudio Canales"/><br /><sub><b>Claudio Canales</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=Klaudioz" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/vitaly-pevgonen"><img src="https://avatars0.githubusercontent.com/u/6272738?v=4?s=60" width="60px;" alt="vitaly-pevgonen"/><br /><sub><b>vitaly-pevgonen</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=vitaly-pevgonen" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://dshemetov.github.io"><img src="https://avatars0.githubusercontent.com/u/1810426?v=4?s=60" width="60px;" alt="Dmitry Shemetov"/><br /><sub><b>Dmitry Shemetov</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=dshemetov" title="Documentation">📖</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/hooncp"><img src="https://avatars1.githubusercontent.com/u/48883554?v=4?s=60" width="60px;" alt="hooncp"/><br /><sub><b>hooncp</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=hooncp" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://rt-canada.ca"><img src="https://avatars1.githubusercontent.com/u/13721239?v=4?s=60" width="60px;" alt="Martin Laws"/><br /><sub><b>Martin Laws</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=martinlaws" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://seanksmith.me"><img src="https://avatars3.githubusercontent.com/u/2085441?v=4?s=60" width="60px;" alt="Sean K Smith"/><br /><sub><b>Sean K Smith</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=sksmith" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://www.linkedin.com/in/kevin-neely/"><img src="https://avatars1.githubusercontent.com/u/37545028?v=4?s=60" width="60px;" alt="Kevin Neely"/><br /><sub><b>Kevin Neely</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=kneely" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://ariefrahmansyah.dev"><img src="https://avatars3.githubusercontent.com/u/8122852?v=4?s=60" width="60px;" alt="Arief Rahmansyah"/><br /><sub><b>Arief Rahmansyah</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=ariefrahmansyah" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://vhanda.in"><img src="https://avatars2.githubusercontent.com/u/426467?v=4?s=60" width="60px;" alt="Vishesh Handa"/><br /><sub><b>Vishesh Handa</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=vHanda" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://www.linkedin.com/in/heroichitesh"><img src="https://avatars3.githubusercontent.com/u/37622734?v=4?s=60" width="60px;" alt="Hitesh Kumar"/><br /><sub><b>Hitesh Kumar</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=HeroicHitesh" title="Documentation">📖</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://spencerwoo.com"><img src="https://avatars2.githubusercontent.com/u/32114380?v=4?s=60" width="60px;" alt="Spencer Woo"/><br /><sub><b>Spencer Woo</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=spencerwooo" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://ingalless.com"><img src="https://avatars3.githubusercontent.com/u/22981941?v=4?s=60" width="60px;" alt="ingalless"/><br /><sub><b>ingalless</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=ingalless" title="Code">💻</a> <a href="https://github.com/foambubble/foam/commits?author=ingalless" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://jmg-duarte.github.io"><img src="https://avatars2.githubusercontent.com/u/15343819?v=4?s=60" width="60px;" alt="José Duarte"/><br /><sub><b>José Duarte</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=jmg-duarte" title="Code">💻</a> <a href="https://github.com/foambubble/foam/commits?author=jmg-duarte" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://www.yenly.wtf"><img src="https://avatars1.githubusercontent.com/u/6759658?v=4?s=60" width="60px;" alt="Yenly"/><br /><sub><b>Yenly</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=yenly" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://www.hikerpig.cn"><img src="https://avatars1.githubusercontent.com/u/2259688?v=4?s=60" width="60px;" alt="hikerpig"/><br /><sub><b>hikerpig</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=hikerpig" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://sigfried.org"><img src="https://avatars1.githubusercontent.com/u/1586931?v=4?s=60" width="60px;" alt="Sigfried Gold"/><br /><sub><b>Sigfried Gold</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=Sigfried" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://www.tristansokol.com"><img src="https://avatars3.githubusercontent.com/u/867661?v=4?s=60" width="60px;" alt="Tristan Sokol"/><br /><sub><b>Tristan Sokol</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=tristansokol" title="Code">💻</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://umbrellait.com"><img src="https://avatars0.githubusercontent.com/u/49779373?v=4?s=60" width="60px;" alt="Danil Rodin"/><br /><sub><b>Danil Rodin</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=umbrellait-danil-rodin" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://www.linkedin.com/in/scottjoewilliams/"><img src="https://avatars1.githubusercontent.com/u/2026866?v=4?s=60" width="60px;" alt="Scott Williams"/><br /><sub><b>Scott Williams</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=scott-joe" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://jackiexiao.github.io/blog"><img src="https://avatars2.githubusercontent.com/u/18050469?v=4?s=60" width="60px;" alt="jackiexiao"/><br /><sub><b>jackiexiao</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=Jackiexiao" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://generativist.substack.com/"><img src="https://avatars3.githubusercontent.com/u/78835?v=4?s=60" width="60px;" alt="John B Nelson"/><br /><sub><b>John B Nelson</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=jbn" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/asifm"><img src="https://avatars2.githubusercontent.com/u/3958387?v=4?s=60" width="60px;" alt="Asif Mehedi"/><br /><sub><b>Asif Mehedi</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=asifm" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/litanlitudan"><img src="https://avatars2.githubusercontent.com/u/4970420?v=4?s=60" width="60px;" alt="Tan Li"/><br /><sub><b>Tan Li</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=litanlitudan" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://shaunagordon.com"><img src="https://avatars1.githubusercontent.com/u/579361?v=4?s=60" width="60px;" alt="Shauna Gordon"/><br /><sub><b>Shauna Gordon</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=ShaunaGordon" title="Documentation">📖</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://mcluck.tech"><img src="https://avatars1.githubusercontent.com/u/1753801?v=4?s=60" width="60px;" alt="Mike Cluck"/><br /><sub><b>Mike Cluck</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=MCluck90" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://brandonpugh.com"><img src="https://avatars1.githubusercontent.com/u/684781?v=4?s=60" width="60px;" alt="Brandon Pugh"/><br /><sub><b>Brandon Pugh</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=bpugh" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://max.davitt.me"><img src="https://avatars1.githubusercontent.com/u/27709025?v=4?s=60" width="60px;" alt="Max Davitt"/><br /><sub><b>Max Davitt</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=themaxdavitt" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://briananglin.me"><img src="https://avatars3.githubusercontent.com/u/2637602?v=4?s=60" width="60px;" alt="Brian Anglin"/><br /><sub><b>Brian Anglin</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=anglinb" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://deft.work"><img src="https://avatars1.githubusercontent.com/u/1455507?v=4?s=60" width="60px;" alt="elswork"/><br /><sub><b>elswork</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=elswork" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://leonh.fr/"><img src="https://avatars.githubusercontent.com/u/19996318?v=4?s=60" width="60px;" alt="léon h"/><br /><sub><b>léon h</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=leonhfr" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://nygaard.site"><img src="https://avatars.githubusercontent.com/u/4606342?v=4?s=60" width="60px;" alt="Nikhil Nygaard"/><br /><sub><b>Nikhil Nygaard</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=njnygaard" title="Documentation">📖</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="http://www.nitwit.se"><img src="https://avatars.githubusercontent.com/u/1382124?v=4?s=60" width="60px;" alt="Mark Dixon"/><br /><sub><b>Mark Dixon</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=nitwit-se" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/joeltjames"><img src="https://avatars.githubusercontent.com/u/3732400?v=4?s=60" width="60px;" alt="Joel James"/><br /><sub><b>Joel James</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=joeltjames" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://www.ryo33.com"><img src="https://avatars.githubusercontent.com/u/8780513?v=4?s=60" width="60px;" alt="Hashiguchi Ryo"/><br /><sub><b>Hashiguchi Ryo</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=ryo33" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://movermeyer.com"><img src="https://avatars.githubusercontent.com/u/1459385?v=4?s=60" width="60px;" alt="Michael Overmeyer"/><br /><sub><b>Michael Overmeyer</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=movermeyer" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/derrickqin"><img src="https://avatars.githubusercontent.com/u/3038111?v=4?s=60" width="60px;" alt="Derrick Qin"/><br /><sub><b>Derrick Qin</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=derrickqin" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://www.linkedin.com/in/zomars/"><img src="https://avatars.githubusercontent.com/u/3504472?v=4?s=60" width="60px;" alt="Omar López"/><br /><sub><b>Omar López</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=zomars" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://robincn.com"><img src="https://avatars.githubusercontent.com/u/1583193?v=4?s=60" width="60px;" alt="Robin King"/><br /><sub><b>Robin King</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=RobinKing" title="Code">💻</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="http://twitter.com/deegovee"><img src="https://avatars.githubusercontent.com/u/4730170?v=4?s=60" width="60px;" alt="Dheepak "/><br /><sub><b>Dheepak </b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=dheepakg" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/daniel-vera-g"><img src="https://avatars.githubusercontent.com/u/28257108?v=4?s=60" width="60px;" alt="Daniel VG"/><br /><sub><b>Daniel VG</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=daniel-vera-g" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Barabazs"><img src="https://avatars.githubusercontent.com/u/31799121?v=4?s=60" width="60px;" alt="Barabas"/><br /><sub><b>Barabas</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=Barabazs" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://enginveske@gmail.com"><img src="https://avatars.githubusercontent.com/u/43685404?v=4?s=60" width="60px;" alt="Engincan VESKE"/><br /><sub><b>Engincan VESKE</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=EngincanV" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://www.paulderaaij.nl"><img src="https://avatars.githubusercontent.com/u/495374?v=4?s=60" width="60px;" alt="Paul de Raaij"/><br /><sub><b>Paul de Raaij</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=pderaaij" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/bronson"><img src="https://avatars.githubusercontent.com/u/1776?v=4?s=60" width="60px;" alt="Scott Bronson"/><br /><sub><b>Scott Bronson</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=bronson" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://rafaelriedel.de"><img src="https://avatars.githubusercontent.com/u/41793?v=4?s=60" width="60px;" alt="Rafael Riedel"/><br /><sub><b>Rafael Riedel</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=rafo" title="Documentation">📖</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Pearcekieser"><img src="https://avatars.githubusercontent.com/u/5055971?v=4?s=60" width="60px;" alt="Pearcekieser"/><br /><sub><b>Pearcekieser</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=Pearcekieser" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/theowenyoung"><img src="https://avatars.githubusercontent.com/u/62473795?v=4?s=60" width="60px;" alt="Owen Young"/><br /><sub><b>Owen Young</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=theowenyoung" title="Documentation">📖</a> <a href="#content-theowenyoung" title="Content">🖋</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://www.prashu.com"><img src="https://avatars.githubusercontent.com/u/476729?v=4?s=60" width="60px;" alt="Prashanth Subrahmanyam"/><br /><sub><b>Prashanth Subrahmanyam</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=ksprashu" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/JonasSprenger"><img src="https://avatars.githubusercontent.com/u/25108895?v=4?s=60" width="60px;" alt="Jonas SPRENGER"/><br /><sub><b>Jonas SPRENGER</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=JonasSprenger" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Laptop765"><img src="https://avatars.githubusercontent.com/u/1468359?v=4?s=60" width="60px;" alt="Paul"/><br /><sub><b>Paul</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=Laptop765" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://bandism.net/"><img src="https://avatars.githubusercontent.com/u/22633385?v=4?s=60" width="60px;" alt="Ikko Ashimine"/><br /><sub><b>Ikko Ashimine</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=eltociear" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/memeplex"><img src="https://avatars.githubusercontent.com/u/2845433?v=4?s=60" width="60px;" alt="memeplex"/><br /><sub><b>memeplex</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=memeplex" title="Code">💻</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/AndreiD049"><img src="https://avatars.githubusercontent.com/u/52671223?v=4?s=60" width="60px;" alt="AndreiD049"/><br /><sub><b>AndreiD049</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=AndreiD049" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/iam-yan"><img src="https://avatars.githubusercontent.com/u/48427014?v=4?s=60" width="60px;" alt="Yan"/><br /><sub><b>Yan</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=iam-yan" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://WikiEducator.org/User:JimTittsler"><img src="https://avatars.githubusercontent.com/u/180326?v=4?s=60" width="60px;" alt="Jim Tittsler"/><br /><sub><b>Jim Tittsler</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=jimt" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://malcolmmielle.wordpress.com/"><img src="https://avatars.githubusercontent.com/u/4457840?v=4?s=60" width="60px;" alt="Malcolm Mielle"/><br /><sub><b>Malcolm Mielle</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=MalcolmMielle" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://snippets.page/"><img src="https://avatars.githubusercontent.com/u/74916913?v=4?s=60" width="60px;" alt="Veesar"/><br /><sub><b>Veesar</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=veesar" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/bentongxyz"><img src="https://avatars.githubusercontent.com/u/60358804?v=4?s=60" width="60px;" alt="bentongxyz"/><br /><sub><b>bentongxyz</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=bentongxyz" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://brianjdevries.com"><img src="https://avatars.githubusercontent.com/u/42778030?v=4?s=60" width="60px;" alt="Brian DeVries"/><br /><sub><b>Brian DeVries</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=techCarpenter" title="Code">💻</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="http://Cliffordfajardo.com"><img src="https://avatars.githubusercontent.com/u/6743796?v=4?s=60" width="60px;" alt="Clifford Fajardo "/><br /><sub><b>Clifford Fajardo </b></sub></a><br /><a href="#tool-cliffordfajardo" title="Tools">🔧</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://cu-dev.ca"><img src="https://avatars.githubusercontent.com/u/6589365?v=4?s=60" width="60px;" alt="Chris Usick"/><br /><sub><b>Chris Usick</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=chrisUsick" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/josephdecock"><img src="https://avatars.githubusercontent.com/u/1145533?v=4?s=60" width="60px;" alt="Joe DeCock"/><br /><sub><b>Joe DeCock</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=josephdecock" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://www.drewtyler.com"><img src="https://avatars.githubusercontent.com/u/5640816?v=4?s=60" width="60px;" alt="Drew Tyler"/><br /><sub><b>Drew Tyler</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=drewtyler" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Lauviah0622"><img src="https://avatars.githubusercontent.com/u/43416399?v=4?s=60" width="60px;" alt="Lauviah0622"/><br /><sub><b>Lauviah0622</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=Lauviah0622" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://www.elastic.co/elastic-agent"><img src="https://avatars.githubusercontent.com/u/1813008?v=4?s=60" width="60px;" alt="Josh Dover"/><br /><sub><b>Josh Dover</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=joshdover" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://phelm.co.uk"><img src="https://avatars.githubusercontent.com/u/4057948?v=4?s=60" width="60px;" alt="Phil Helm"/><br /><sub><b>Phil Helm</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=phelma" title="Documentation">📖</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/lingyv-li"><img src="https://avatars.githubusercontent.com/u/8937944?v=4?s=60" width="60px;" alt="Larry Li"/><br /><sub><b>Larry Li</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=lingyv-li" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/infogulch"><img src="https://avatars.githubusercontent.com/u/133882?v=4?s=60" width="60px;" alt="Joe Taber"/><br /><sub><b>Joe Taber</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=infogulch" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://www.readingsnail.pe.kr"><img src="https://avatars.githubusercontent.com/u/1904967?v=4?s=60" width="60px;" alt="Woosuk Park"/><br /><sub><b>Woosuk Park</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=readingsnail" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://www.dmurph.com"><img src="https://avatars.githubusercontent.com/u/294026?v=4?s=60" width="60px;" alt="Daniel Murphy"/><br /><sub><b>Daniel Murphy</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=dmurph" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Dominic-DallOsto"><img src="https://avatars.githubusercontent.com/u/26859884?v=4?s=60" width="60px;" alt="Dominic D"/><br /><sub><b>Dominic D</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=Dominic-DallOsto" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://elgirafo.xyz"><img src="https://avatars.githubusercontent.com/u/80516439?v=4?s=60" width="60px;" alt="luca"/><br /><sub><b>luca</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=elgirafo" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Lloyd-Jackman-UKPL"><img src="https://avatars.githubusercontent.com/u/55206370?v=4?s=60" width="60px;" alt="Lloyd Jackman"/><br /><sub><b>Lloyd Jackman</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=Lloyd-Jackman-UKPL" title="Documentation">📖</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="http://sn3akiwhizper.github.io"><img src="https://avatars.githubusercontent.com/u/102705294?v=4?s=60" width="60px;" alt="sn3akiwhizper"/><br /><sub><b>sn3akiwhizper</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=sn3akiwhizper" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://jonathanpberger.com/"><img src="https://avatars.githubusercontent.com/u/41085?v=4?s=60" width="60px;" alt="jonathan berger"/><br /><sub><b>jonathan berger</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=jonathanpberger" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/badsketch"><img src="https://avatars.githubusercontent.com/u/8953212?v=4?s=60" width="60px;" alt="Daniel Wang"/><br /><sub><b>Daniel Wang</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=badsketch" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://yongliangliu.com"><img src="https://avatars.githubusercontent.com/u/41845017?v=4?s=60" width="60px;" alt="Liu YongLiang"/><br /><sub><b>Liu YongLiang</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=tlylt" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://scottakerman.com"><img src="https://avatars.githubusercontent.com/u/15224439?v=4?s=60" width="60px;" alt="Scott Akerman"/><br /><sub><b>Scott Akerman</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=Skakerman" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://www.jim-graham.net/"><img src="https://avatars.githubusercontent.com/u/430293?v=4?s=60" width="60px;" alt="Jim Graham"/><br /><sub><b>Jim Graham</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=jimgraham" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://t.me/littlepoint"><img src="https://avatars.githubusercontent.com/u/7611700?v=4?s=60" width="60px;" alt="Zhizhen He"/><br /><sub><b>Zhizhen He</b></sub></a><br /><a href="#tool-hezhizhen" title="Tools">🔧</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://amnesiak.org/me"><img src="https://avatars.githubusercontent.com/u/952059?v=4?s=60" width="60px;" alt="Tony Cheneau"/><br /><sub><b>Tony Cheneau</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=tcheneau" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/nicholas-l"><img src="https://avatars.githubusercontent.com/u/12977174?v=4?s=60" width="60px;" alt="Nicholas Latham"/><br /><sub><b>Nicholas Latham</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=nicholas-l" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://thara.dev"><img src="https://avatars.githubusercontent.com/u/1532891?v=4?s=60" width="60px;" alt="Tomochika Hara"/><br /><sub><b>Tomochika Hara</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=thara" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/dcarosone"><img src="https://avatars.githubusercontent.com/u/11495017?v=4?s=60" width="60px;" alt="Daniel Carosone"/><br /><sub><b>Daniel Carosone</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=dcarosone" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/MABruni"><img src="https://avatars.githubusercontent.com/u/100445384?v=4?s=60" width="60px;" alt="Miguel Angel Bruni Montero"/><br /><sub><b>Miguel Angel Bruni Montero</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=MABruni" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Walshkev"><img src="https://avatars.githubusercontent.com/u/77123083?v=4?s=60" width="60px;" alt="Kevin Walsh "/><br /><sub><b>Kevin Walsh </b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=Walshkev" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://hereistheusername.github.io/"><img src="https://avatars.githubusercontent.com/u/33437051?v=4?s=60" width="60px;" alt="Xinglan Liu"/><br /><sub><b>Xinglan Liu</b></sub></a><br /><a href="https://github.com/foambubble/foam/commits?author=hereistheusername" title="Code">💻</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

**Foam** was inspired by [Roam Research](https://roamresearch.com/) and the [Zettelkasten methodology](https://zettelkasten.de/posts/overview)

**Foam** wouldn't be possible without [Visual Studio Code](https://code.visualstudio.com/) and [GitHub](https://github.com/), and relies heavily on our fantastic open source [[recommended-extensions]] and all their contributors!

## License

Foam is licensed under the [MIT license](LICENSE.txt).

[//begin]: # "Autogenerated link references for markdown compatibility"
[graph-visualization]: user/features/graph-visualization.md "Graph Visualization"
[backlinking]: user/features/backlinking.md "Backlinking"
[recommended-extensions]: user/getting-started/recommended-extensions.md "Recommended Extensions"
[recipes]: user/recipes/recipes.md "Recipes"
[frequently-asked-questions]: user/frequently-asked-questions.md "Frequently Asked Questions"
[principles]: principles.md "Principles"
[contribution-guide]: dev/contribution-guide.md "Contribution Guide"
[//end]: # "Autogenerated link references"
