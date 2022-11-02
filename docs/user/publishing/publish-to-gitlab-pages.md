# GitLab Pages

You don't have to use GitHub to serve Foam pages. You can also use GitLab.

Gitlab pages can be kept private for private repo, so that your notes are still private.

## Setup a project

### Generate the directory from GitHub

Generate a solution using the [Foam template](https://github.com/foambubble/foam-template).

Change the remote to GitLab, or copy all the files into a new GitLab repo

## Publishing pages with Gatsby

### Setup the Gatsby config

Add a .gatsby-config.js file where:

* `$REPO_NAME` correspond to the name of your gtlab repo.
* `$USER_NAME` correspond to your gitlab username.

```js
const path = require("path");
const pathPrefix = `/$REPO_NAME`;

// Change me
const siteMetadata = {
  title: "A title",
  shortName: "A short name",
  description: "",
  imageUrl: "/graph-visualization.jpg",
  siteUrl: "https://$USER_NAME.gitlab.io",
};
module.exports = {
  siteMetadata,
  pathPrefix,
  flags: {
    DEV_SSR: true,
  },
  plugins: [
    `gatsby-plugin-sharp`,
    {
      resolve: "gatsby-theme-primer-wiki",
      options: {
        defaultColorMode: "night",
        icon: "./path_to/logo.png",
        sidebarComponents: ["tag", "category"],
        nav: [
          {
            title: "Github",
            url: "https://github.com/$USER_NAME/",
          },
          {
            title: "Gitlab",
            url: "https://gitlab.com/$USER_NAME/",
          },
        ],
        editUrl:
          "https://gitlab.com/$USER_NAME/$REPO_NAME/tree/main/",
      },
    },
    {
      resolve: "gatsby-source-filesystem",
      options: {
        name: "content",
        path: `${__dirname}`,
        ignore: [`**/\.*/**/*`],
      },
    },

    {
      resolve: "gatsby-plugin-manifest",
      options: {
        name: siteMetadata.title,
        short_name: siteMetadata.shortName,
        start_url: pathPrefix,
        background_color: `#f7f0eb`,
        display: `standalone`,
        icon: path.resolve(__dirname, "./path_to/logo.png"),
      },
    },
    {
      resolve: `gatsby-plugin-sitemap`,
    },
    {
      resolve: "gatsby-plugin-robots-txt",
      options: {
        host: siteMetadata.siteUrl,
        sitemap: `${siteMetadata.siteUrl}/sitemap/sitemap-index.xml`,
        policy: [{ userAgent: "*", allow: "/" }],
      },
    },
  ],
};
```

And a `package.json` file containing:

```json
{
    "private": true,
    "name": "wiki",
    "version": "1.0.0",
    "license": "MIT",
    "scripts": {
        "develop": "gatsby develop -H 0.0.0.0",
        "start": "gatsby develop -H 0.0.0.0",
        "build": "gatsby build",
        "clean": "gatsby clean",
        "serve": "gatsby serve",
        "test": "echo test"
    },
    "dependencies": {
        "@primer/react": "^34.1.0",
        "@primer/css": "^17.5.0",
        "foam-cli": "^0.11.0",
        "gatsby": "^3.12.0",
        "gatsby-plugin-manifest": "^3.12.0",
        "gatsby-plugin-robots-txt": "^1.6.9",
        "gatsby-plugin-sitemap": "^5.4.0",
        "gatsby-source-filesystem": "^3.12.0",
        "gatsby-theme-primer-wiki": "^1.14.5",
        "react": "^17.0.2",
        "react-dom": "^17.0.2"
    }
}
```

The theme will be based on [gatsby-theme-primer-wiki](https://github.com/theowenyoung/gatsby-theme-primer-wiki).

To test the theme locally first run `yarn install` and then use `gatsby develop` to serve the website.
See gatsby documentation for more details.

### Set-up the CI for deployment

Create a `.gitlab-ci.yml` file containing:

```yml
# To contribute improvements to CI/CD templates, please follow the Development guide at:
# https://docs.gitlab.com/ee/development/cicd/templates.html
# This specific template is located at:
# https://gitlab.com/gitlab-org/gitlab/-/blob/master/lib/gitlab/ci/templates/Pages/Gatsby.gitlab-ci.yml

image: node:latest

stages:
  - deploy

pages:
  stage: deploy
  # This folder is cached between builds
  # https://docs.gitlab.com/ee/ci/yaml/index.html#cache
  cache:
    paths:
      - node_modules/
      # Enables git-lab CI caching. Both .cache and public must be cached, otherwise builds will fail.
      - .cache/
      - public/
  script:
    - yarn install
    - ./node_modules/.bin/gatsby build --prefix-paths
  artifacts:
    paths:
      - public
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

This pipeline will now serve your website on every push to the main branch of your project.

## Publish with Jekyll

### Add a _config.yaml

Add another file to the root directory (the one with `readme.md` in it) called `_config.yaml` (no extension)

```yaml
title: My Awesome Foam Project
baseurl: "" # the subpath of your site, e.g. /blog
url: "/" # the base hostname & protocol for your site
theme: jekyll-theme-minimal
plugins:
  - jekyll-optional-front-matter
optional_front_matter:
  remove_originals: true
defaults:
  -
    scope:
      path: "" # we need to add this to properly render layouts
    values:
      layout: "default"
```

You can choose a theme if you want from places like [Jekyll Themes](https://jekyllthemes.io/)

### Add a Gemlock file

Add another file to the root directory (the one with `readme.md` in it) called `Gemfile` (no extension)

```ruby
source "https://rubygems.org"

gem "jekyll"
gem "jekyll-theme-minimal"
gem "jekyll-optional-front-matter"
```

Commit the file and push it to gitlab.

### Setup CI/CD

1. From the project home in GitLab click `Set up CI/CD`
2. Choose `Jekyll` as your template from the template dropdown
3. Click `commit`
4. Now when you go to CI / CD > Pipelines, you should see the code running

### Troubleshooting

- *Could not locate Gemfile* - You didn't follow the steps above to [Add a Gemlock file](#add-a-gemlock-file)
- *Conversion error: Jekyll::Converters::Scss encountered an error while converting* You need to reference a theme.
- *Pages are running in CI/CD, but I only ever see `test`, and never deploy* - Perhaps you've renamed the main branch (from master) - check the settings in `.gitlab-ci.yml` and ensure the deploy command is running to the branch you expect it to.
- *I deployed, but my .msd files don't seem to be being converted into .html files* - You need a gem that GitHub installs by default - check `gem "jekyll-optional-front-matter"` appears in the `Gemfile`
