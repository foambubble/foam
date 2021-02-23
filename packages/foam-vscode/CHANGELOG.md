# Change Log

All notable changes to the "foam-vscode" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.10.1] - 2021-02-23

Fixes and Improvements:

- Model: fixed consolidation of model after change events
- Dataviz: improved consolidation of graph

## [0.10.0] - 2021-02-18

Features:

- Notes preview in panels (#468 - thanks @leonhfr)
- Added more style options to graph setting (lineColor, lineWidth, particleWidth (#479 - thanks @nitwit-se)

Internal:

- Refactored data model representation of notes graph: `FoamWorkspace` (#467)

## [0.9.1] - 2021-01-28

Fixes and Improvements:

- Panel: Updating orphan panel when adding and removing notes (#464 - thanks @leonhfr)

## [0.9.0] - 2021-01-27

Features:

- Panel: Added orphan panel (#457 - thanks @leonhfr)

## [0.8.0] - 2021-01-15

Features:

- Model: Now direct links are included in the Foam model (#433)
- Commaands: Added `Open random note` command (#440 - thanks @MCluck90)
- Dataviz: Added graph style override from VsCode theme (#438 - thanks @jmg-duarte)
- Dataviz: Added graph style customization based on note type (#449)

Fixes and Improvements:

- Various improvements and fixes in documentation (thanks @anglinb, @themaxdavitt, @elswork)

## [0.7.7] - 2020-12-31

Fixes and Improvements:

- Fixed word-based-suggestions (#415 #417 - thanks @bpugh!)
- Date snippets use standard wikilink syntax (#416 - thanks @MCluck90!)

## [0.7.6] - 2020-12-20

Fixes and Improvements:

- Fixed "Janitor" command issue in Windows (#410)

## [0.7.5] - 2020-12-17

Fixes and Improvements:

- Fixed "Open Daily Note" command issue in Windows (#407)

## [0.7.4] - 2020-12-16

Fixes and Improvements:

- Fixed a bug that was causing Foam to not work correctly in Windows (#391)

## [0.7.3] - 2020-12-13

Fixes and Improvements:

- Foam model: fix to link references on node update/deletion (#393 - thanks @AndrewNatoli)
- Dataviz: fix hover/selection (#401)
- Dataviz: improved logging
- Dataviz: style tweaks for better readability

## [0.7.2] - 2020-11-27

Fixes and Improvements:

- Dataviz: Sync note deletion
- Foam model: Fix to wikilink format (#386 - thanks @SanketDG)

## [0.7.1] - 2020-11-27

New Feature:

- Foam logging can now be inspected in VsCode Output panel (#377)

Fixes and Improvements:

- Foam model: Fixed bug in tags parsing (#382)
- Dataviz: Graph canvas now resizes with window (#383, #375)
- Dataviz: Limit label length for placeholder nodes (#381)

## [0.7.0] - 2020-11-25

New Features:

- Foam stays in sync with changes in notes
- Dataviz: Added multiple selection in graph (shift+click on node)

Fixes and Improvements:

- Dataviz: Graph uses VSCode theme colors
- Reporting: Errors occurring during foam bootstrap are now reported for easier debugging

## [0.6.0] - 2020-11-19

New features:

- Added command to create notes from templates (#115 - Thanks @ingalless)

Fixes and Improvements:

- Foam model: Fixed bug that prevented wikilinks from being slugified (#323 - thanks @SanketDG)
- Editor: Improvements in defaults for ignored files setting (thanks @jmg-duarte)
- Dataviz: Centering of the graph on note displayed in active editor (#319)
- Dataviz: Improved graph styling
- Dataviz: Added setting to cap the length of labels in the graph (thanks @jmg-duarte)
- Misc: Fixed problem with packaging icon in extension (#350 - thanks @litanlitudan)

## [0.5.0] - 2020-11-09

New features:

- Added tags panel (#311)

Fixes and Improvements:

- Date snippets now support configurable completion actions (#307 - thanks @ingalless)
- Graph now show note titles when zooming in (#310)
- New `foam.files.ignore` setting to exclude globs from being processed by Foam (#304 - thanks @jmg-duarte)
- Errors in YAML parsing no longer causes foam to crash (#320)
- Fixed error in CLI command janitor & migrate (#312 - thanks @hikerpig)

## [0.4.0] - 2020-10-28

New features:

- Added `Foam: Show Graph` command
- Added date snippets (/+1d, ...) to create wikilinks to dates in daily note format
- Added `Foam: Copy to Clipboard without brackets` command

Improvements:

- Added new option to not generate wikilink definitions `foam.edit.linkReferenceDefinitions`: `off`

Bug Fixes:

- Daily note could be created before the daily note directory (#232)
- Fix issue with janitor crashing when file is only frontmatter (#222)
- Fix link references spacing when there is no trailing newline (#236)

New experimental features:

- Introduced [foam local plugins](https://foambubble.github.io/foam/foam-local-plugins)

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
