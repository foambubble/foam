# Foam

_I want to build a second brain, but I also want to own my brain._

See also:
- Thoughts on [Branding](branding.md)
- Should I [create a new language](creating_a_new_language.md)
- Would be cool to [publish pages](publishing_pages.md)
- [Random thoughts](random_thoughts.md) and feature ideas
  
## Faux Roam

Roam Research is cool, but it's a proprietary, non-free tool. I'm sure that in the future, Roam will develop a killer feature on top of the knowledge graph they're building, but for the time being it's a **glorified text editor** with good keyboard shortcuts and two-way linking between documents.

Enter Foam, a Roamlike focused work environment built in VSCode.

## Pros over Roam

- Free and free, easily migrateable hosting (Git)
- Customise your editor (colors, plugins, keyboard shortcuts, etc)
- Use Git history to get more context on what you were working on when
  -  Add metadata like "Raw thoughts", or "Meeting with John"
  -  Roll back changes
- CMD+P to navigate between files
- Full freedom to write free content, embedded code samples with syntax highlighting
- Run code with Code Runner, Jupyter Notebooks etc

## What can we already do without any custom code?

- [x] Light editor theme
- [x] Markdown All In One plugin set
  - [x] File name autocompletiong for links
  - [x] List indentation
  - [x] Keyboard shortcuts
  - [x] Checklists (alt-c)
  - [x] Cmd+Click file name to navigate to it
- [x] Using GitLens hover annotations to remember when changes were made
  - [ ] Maybe do something cool with [gitlens modes](https://github.com/eamodio/vscode-gitlens/tree/master/#modes-)
- [x] Git automator
  - [x] Cmd+Shift+A to add all files
  - [x] Cmd+Shift+Z to push all commits
  - [ ] Automatic commit messages (TODO, see Git Automator readme)

## How to make my setup usable for others without code
- [ ] Template workspace/repo to clone
- [ ] Comes with a `.vscode/settings.json`
  - [ ] Recommended plugins
    - [ ] Markdown all in one
    - [ ] Some editor theme
    - [ ] Git Lens
    - [ ] Git Automator
  - [ ] Custom shortcuts (if possible in workspace?)

## Missing Roam features

Some things I would have to write code for

### Big features

- Unlinked references and back links from other pages (this is a big one)
  - Could be implemented as a terminal view of sort, run a language server in the background and show them in the "output" tab like you show test results in jest
- Automatically create a new page when referencing an unknown file
  - This support could be added to MD All in one
- Knowledge graph visualiser
  - Trivial to build once graph is assembled

### Minor UX things

- [ ] Can't just call it `Some page`, must be some_page.md
- [ ] Should be easier to reference for a file in workspace without `[]()`, for example just [filename] (no extensions needed, workspace can treat extensionless files as Foam files)
- [ ] Renaming/moving documents requires to rename all references
  - [ ] Could probably be automated

