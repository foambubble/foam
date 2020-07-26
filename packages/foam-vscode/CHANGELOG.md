# Change Log

All notable changes to the "foam-vscode" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.3.1] - 2020-07-26

Fixes and improvements:

- Fix [Daily Notes](https://foambubble.github.io/foam/daily-notes) command on Windows.

## [0.3.0] - 2020-07-25

New features:

- [Daily Notes](https://foambubble.github.io/foam/daily-notes) 
- [Janitor](https://foambubble.github.io/foam/workspace-janitor) for updating headings and link references across your workspace

Fixes and improvements: 

- [Configuration setting for generating link reference definitions with file extension](https://foambubble.github.io/foam/link-reference-definitions#configuration) to support standard markdown tools, such as GitHub web UI
- [Improvements to how new notes are indexed](https://github.com/foambubble/foam/pull/156)

## [0.2.0] - 2020-07-12

Improvements:

- Order link references alphabetically to cause smaller diffs
- Remove link references when links are removed
- Documentation improvements

Underneath, everything has changed:

- Published from [Foam monorepo](https://github.com/foambubble/foam)
- Rewrote markdown parsing to use unifiedjs AST
- Rewrote workspace index to user graphlib graph data structures

These changes will enable to make more robust and ambitious releases more frequently 🎉

## [0.1.7] - 2020-07-04

- Support paths to files in subdirectories

## [0.1.6] - 2020-07-02

- Add support for VS Code 1.45.1

## [0.1.5] - 2020-06-29

- Fix multiple issues related to excess/disappearing newlines ([#3](https://github.com/foambubble/foam-vscode/issues/3), [#5](https://github.com/foambubble/foam-vscode/issues/5), [#10](https://github.com/foambubble/foam-vscode/issues/10))

## [0.1.4] - 2020-06-25

- Fix flaky reference block replacement logic that would occasionally leave
  trailing fragments in the end of the document ([#3](https://github.com/foambubble/foam-vscode/issues/3))

## 0.1.3 - 2020-06-25

- Include Getting Started instructions

## [0.1.2] - 2020-06-24

- Update extension name.

## [0.1.1] - 2020-06-24

- Fix markdown link format (`link.md` to just `link`).

## [0.1.0] - 2020-06-24

- Initial release
