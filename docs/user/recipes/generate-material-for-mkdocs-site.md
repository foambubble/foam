# Generate a site using the Material for MkDocs theme

Configuring a static-site generator (SSG) to publish your Foam provides access to functionality not available through Foam's default publishing mechanism.  For example, compare the [original Foam documentation site](https://foambubble.github.io/foam/) with a [Material for MkDocs version](https://djplaner.github.io/foam-with-material-for-mkdocs/) created using the simple configuration detailed below. Try out the search functionality on the Material for MkDocs version. This [digital garden](https://djon.es/memex) and this [blog](https://djon.es/blog/) provide more advanced examples of Foam content published using Material for MkDocs.

The following explains how to configure the [Material for MkDocs theme](https://squidfunk.github.io/mkdocs-material/) for the [MkDocs SSG](https://www.mkdocs.org) to publish your Foam.

Like most SSGs (e.g. [Gatsby](https://www.gatsbyjs.com/) is another SSG that can be [used to publish your Foam](https://foambubble.github.io/foam/user/publishing/generate-gatsby-site)) site content is accepted in the form of Markdown files. Like those produced by Foam. SSGs differ in the languages they are written in (MkDocs is Python, Gatsby is Javascript and React) and the features they provide. MkDocs and Material for MkDocs are designed to support project documentation.  Gatsby is more general purpose and provides a nice feature set.

You choose your poison. 

## Requirements

To use Material for MkDocs to publish your Foam you need:

- An existing Foam workspace with content.
- [Python installed on your computer](https://realpython.com/installing-python/).
- Some familiarity and comfort with using the command line on your computer.

## Instructions

Configuring Material for MkDocs to publish your Foam involves the following steps:

1. [Install Material for MkDocs and other requirements](#install-material-for-mkdocs-and-other-requirements).

    Install the Material for MkDocs theme, MkDocs, and other required Python modules. 

2. [Configure Material for MkDocs for your Foam](#configure-material-for-mkdocs-for-your-foam).

    Create a `mkdocs.yml` file in the root of your Foam workspace directory. This file configures Material for MkDocs to work with your Foam.

2. [Preview and test your site locally](#preview-and-test-your-site-locally).

    Run MkDocs to preview and test your Material for MkDocs Foam site locally. Good for testing and local use.

3. [Further customise Material for MkDocs](#further-customise-material-for-mkdocs).

    Explore and leverage the additional configuration settings, possible customisations, and additional themes and plugins to customise your site to your needs.

4. [Publish your site](#publish-your-site).

    Publish your Material for MkDocs Foam site to the web for others to enjoy. There are many options for publishing your site, including GitHub, GitLab, Netlify, and others.

### Install Material for MkDocs and other requirements

Material for MkDocs provides [detailed installation instructions](https://squidfunk.github.io/mkdocs-material/getting-started/) which cover the full range of options for installing and configuring Material for MkDocs. The following is a summary of the recommended process.

1. Within your Foam workspace directory, create a [Python virtual environment](https://realpython.com/what-is-pip/#using-pip-in-a-python-virtual-environment)

    - `python -m venv .venv`
    - `source .venv/bin/activate` (Linux/Mac) or `.venv\Scripts\activate` (Windows)

2. Install Material for MkDocs

    - `pip install mkdocs-material`

3. Install additional Python modules

    - `pip install mkdocs-roamlinks-plugin` 
    - `pip install mkdocs-exclude` 

### Configure Material for MkDocs for your Foam

To configure Material for MkDocs for your Foam workspace, create a `mkdocs.yml` file in the root of your Foam workspace directory. Below you will find a sample `mkdocs.yml` file (adapted from the [foam-mkdocs-template repository](https://github.com/Jackiexiao/foam-mkdocs-template/tree/master)). Copy and paste it into your `mkdocs.yml` file, then edit it to suit your needs. In particular, don't forget to change the `site_name` and `site_url` to match your Foam workspace. Though this can be left a little later.

Material for MkDocs provides documentation on both [minimal](https://squidfunk.github.io/mkdocs-material/creating-your-site/#minimal-configuration) and [advanced](https://squidfunk.github.io/mkdocs-material/creating-your-site/#advanced-configuration) configuration of `mkdocs.yml`. Which are revisited in the [customise section below](#further-customise-your-site)

```yaml
site_name: My site # Change this to your site name
site_url: https://mydomain.org/mysite # change this
theme:
  name: material
  features:
    - navigation.expand 
    - tabs 
markdown_extensions: 
  - attr_list 
  - pymdownx.tabbed
  - nl2br
  - toc:
      permalink: '#' 
      slugify: !!python/name:pymdownx.slugs.uslugify 
  - admonition
  - codehilite:
      guess_lang: false
      linenums: false
  - footnotes
  - meta
  - def_list
  - pymdownx.arithmatex
  - pymdownx.betterem:
      smart_enable: all
  - pymdownx.caret
  - pymdownx.critic
  - pymdownx.details
  - pymdownx.inlinehilite
  - pymdownx.magiclink
  - pymdownx.mark
  - pymdownx.smartsymbols
  - pymdownx.superfences
  - pymdownx.tasklist
  - pymdownx.tilde
plugins:
  - search
  - roamlinks 
  - exclude:
      glob:
        - "*.tmp"
        - "*.pdf"
        - "*.gz"
      regex:
        - '.*\.(tmp|bin|tar)$'
```

### Preview and test your site locally

MkDocs provides a live preview server allowing you to preview and test your Material for MkDocs Foam site. The server will continue to rebuid your site as you write. 

The simplest method to use the preview service is to run the following command whilst in the rood directory of your Foam workspace:

```bash
mkdocs serve
```

See the Material for MkDocs site for more, including [how to run the preview server via docker](https://squidfunk.github.io/mkdocs-material/creating-your-site/#previewing-as-you-write)

### Further customise your site

Further customisation is available through expanding the configuration of Material for MkDocs, using additional MkDocs plugins, customising HTML/CSS, using Markdown extensions, writing your own Python scripts, and more.

For more on the available customisation paths, see the following:

- Material for MkDocs [Advanced configuration](https://squidfunk.github.io/mkdocs-material/creating-your-site/#advanced-configuration) or the [Set up section](https://squidfunk.github.io/mkdocs-material/setup/)

    For more configuration options to be included in your `mkdocs.yml` file, including customising: colours, fonts, language, icons, navigation, header, footer etc.

- Material for MkDocs [Customisation](https://squidfunk.github.io/mkdocs-material/customization/)

    For advice on enhancing the visual design of your site by customising and replacing provided HTML, CSS, and Javascript.

- Material for MkDocs [Reference](https://squidfunk.github.io/mkdocs-material/reference/)

    An overview of customisation methods that can be used directly within your Markdown files, including: admonitions, annotations, buttons, code blocks, content tabs, data tables, diagrams, grids, Mathematics, etc.

- a [catalog of 300 MkDocs projects and plugins](https://github.com/mkdocs/catalog#readme) 

    For functionality and ideas not included in Material for MkDocs, including: additional themes, plugins, and extensions.

### Building and publishing your site

As a Static Site Generator (SSG), MkDocs generates a collection of static HTML and other types of files. Publishing your site involves building those HTML files and placing them onto your web server. The method will vary depending on your web server and hosting provider. 

The MkDocs documentation site provides an explanation of the [simplest method to publish your site to any provider](https://www.mkdocs.org/user-guide/deploying-your-docs/#other-providers) using `mkdocs build` and `scp`.

The Material for MkDocs [publish page](https://squidfunk.github.io/mkdocs-material/publishing-your-site/) lists options for publishing to

- GitHub using [mkdocs](https://squidfunk.github.io/mkdocs-material/publishing-your-site/#with-mkdocs)

    Perhaps the simplest method, if you are already using GitHub to host your Foam workspace.

- GitHub using [GitHub actions](https://squidfunk.github.io/mkdocs-material/publishing-your-site/github-actions/)

    A more automated method of publishing your site to GitHub, using GitHub actions.

- [GitLab](https://squidfunk.github.io/mkdocs-material/publishing-your-site/#with-mkdocs)

- [Cloudflage pages](https://deborahwrites.com/guides/deploy-host-mkdocs/deploy-mkdocs-material-cloudflare/)

- [Netlify](https://deborahwrites.com/guides/deploy-host-mkdocs/deploy-mkdocs-material-netlify/)

- [Fly.io](https://documentation.breadnet.co.uk/cloud/fly/mkdocs-on-fly/#prerequisites)

- [Scaleway](https://www.scaleway.com/en/docs/tutorials/using-bucket-website-with-mkdocs/)

