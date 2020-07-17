# GitLab Pages

You don't have to use GitHub to serve Foam pages. You can also use GitLab.

## Setup a project

### Generate the directory from GitHub

Generate a solution using the [Foam template].

Change the remote to GitLab, or copy all the files into a new GitLab repo.

### Add a _config.yaml
Add another file to the root directory (the one with `readme.md` in it) called `_config.yaml` (no extension) 

```yaml
title: My Awesome Foam Project
baseurl: "" # the subpath of your site, e.g. /blog
url: "/" # the base hostname & protocol for your site
theme: jekyll-theme-minimal
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

## Setup CI/CD

1. From the project home in GitLab click `Set up CI/CD`
2. Choose `Jekyll` as your template from the template dropdown
3. Click `commit`
4. Now when you go to CI / CD > Pipelines, you should see the code running

## Troubleshooting

- *Could not locate Gemfile* - You didn't follow the steps above to [#Add a Gemlock file]
- *Conversion error: Jekyll::Converters::Scss encountered an error while converting* You need to reference a theme.
- *Pages are running in CI/CD, but I only ever see `test`, and never deploy* - Perhaps you've renamed the main branch (from master) - check the settings in `.gitlab-ci.yml` and ensure the deploy command is running to the branch you expect it to.
- *I deployed, but my .msd files don't seem to be being converted into .html files* - You need a gem that GitHub installs by default - check `gem "jekyll-optional-front-matter"` appears in the `Gemfile`
