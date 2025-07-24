# Change Log

All notable changes to the "foam-vscode" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.27.1] - 2025-07-24

Fixes and Improvements:

- Fixed handling of daily note template on Windows machines (#1492)

## [0.27.0] - 2025-07-23

Features:

- Introduced a unified note creation engine supporting both Markdown and JavaScript templates

Internal:

- Improved testing framework by creating a mocked VS Code environment

## [0.26.12] - 2025-06-18

Fixes and Improvements:

- Fix YAML parsing (#1467)
- Improved regex parsing (#1479 - thanks @s-jacob-powell)

## [0.26.11] - 2025-04-19

Fixes and Improvements:

- Support for custom fonts in graph view (#1457 - thanks @Tenormis)

## [0.26.10] - 2025-03-29

Fixes and Improvements:

- General improvment of wiki embeds (#1443)

## [0.26.9] - 2025-03-29

Fixes and Improvements:

- Defensive get of link object ID in graph (#1438)

Internal:

- Updated `force-graph` library

## [0.26.8] - 2025-03-14

Fixes and Improvements:

- Tag hierarchy now visible in graph (#1436)
- Improved Notes Explorer layout

## [0.26.7] - 2025-03-09

Fixes and Improvements:

- Improved parsing of tags (fixes #1434)

## [0.26.6] - 2025-03-08

Fixes and Improvements:

- Improved graph based navigation when running in virtual workspace
- Improved wikilink embeds and fixed cycle detection issue (#1430)
- Added links in tags to navigate to corresponding tag explorer item (#1432)

Internal:

- Renamed branch from `master` to `main`

## [0.26.5] - 2025-02-21

Fixes and Improvements:

- Improved handling of virtual FS URIs (#1426)

## [0.26.4] - 2024-11-12

Fixes and Improvements:

- Improved handling of virtual FS URIs (#1409)

## [0.26.3] - 2024-11-12

Fixes and Improvements:

- Finetuned use of triemap (#1411 - thanks @pderaaij)

## [0.26.2] - 2024-11-06

Fixes and Improvements:

- Performance improvements (#1406 - thanks @pderaaij)

## [0.26.1] - 2024-10-09

Fixes and Improvements:

- Fixed issue with Buffer in web extension (#1401 - thanks @pderaaij)

## [0.26.0] - 2024-10-01

Features:

- Foam is now a web extension! (#1395 - many thanks @pderaaij)

## [0.25.12] - 2024-07-13

Fixes and Improvements:

- Improved YAML support (#1367)
- Added convesion of wikilinks to markdown links (#1365 - thanks @hereistheusername)
- Refactored util and settings code

## [0.25.11] - 2024-03-18

Fixes and Improvements:

- Actually fixed bug in graph computation (#1345)

## [0.25.10] - 2024-03-18

Fixes and Improvements:

- Fixed bug in graph computation (#1345)

## [0.25.9] - 2024-03-17

Fixes and Improvements:

- Improved note creation from placeholder (#1344)

## [0.25.8] - 2024-02-21

Fixes and Improvements:

- Upgraded dataformat to improve support for daily note naming (#1326 - thanks @rcyeh)

## [0.25.7] - 2024-01-16

Fixes and Improvements:

- Modifies url encoding to target only the filename and skip spaces (#1322 - thanks @MABruni)
- Minor tweak to quick action menu with suggestions for section name

## [0.25.6] - 2023-12-13

Fixes and Improvements:

- Fixed wikilink definition encoding (#1311 - thanks @MABruni)

## [0.25.5] - 2023-11-30

Fixes and Improvements:

- Using note title in preview (#1309)

## [0.25.4] - 2023-09-19

Fixes and Improvements:

- Added support for linking sections within same document (#1289)
- Fixed note embedding bug (#1286 - thanks @badsketch)

## [0.25.3] - 2023-09-07

Fixes and Improvements:

- Fixed incorrect handling of embedding of non-existing notes (#1283 - thanks @badsketch)
- Introduced Note Embedding Sytanx (#1281 - thanks @badsketch)
- Attachments are not considered when computing orphan notes (#1242)

## [0.25.2] - 2023-09-02

Fixes and Improvements:

- Added content-only embed styles (#1279 - thanks @badsketch)
- Added expand-all button to tree views (#1276)

## [0.25.1] - 2023-08-23

Fixes and Improvements:

- Added support for path parameter in filter (#1250)
- Added grouping and filtering to tag explorer (#1275)
- Added new setting to control note embedding (#1273 - thanks @badsketch)
- Added last week's days to snippets (#1248 - thanks @jimgraham)

Internal:

- Updated jest to v29 (#1271 - thanks @nicholas-l)
- Improved test cleanup and management (#1274)

## [0.25.0] - 2023-06-30

Features:

- Support for multiple extensions and custom default extension (#1235)
- Added `FOAM_TITLE_SAFE` template variable (#1232)

Fixes and Improvements:

- Connections panel tweaks (#1233)

## [0.24.0] - 2023-05-19

Features:

- Converted backlinks panel into more general connections panel (#1230)

Internal:

- Improved janitor code (#1228)
- Refactored code related to tree view panels (#1226)
- Lint and cleanup (#1224)

## [0.23.0] - 2023-05-06

Features:

- Added notes explorer (#1223)

Fixes and Improvements:

- Enabled tag completion in front matter (#1191 - thanks @jimgraham)
- Various improvements to tree views (#1220)

## [0.22.2] - 2023-04-20

Fixes and Improvements:

- Support to show placeholders only for open file in panel (#1201, #988)
- Show note block in panels on hover preview (#1201, #800)
- Show tag references within tag explorer (#1201)
- Improved structure of view related commands (#1201)
- Ignore `.foam` directory

## [0.22.1] - 2023-04-15

Fixes and Improvements:

- Allow the `#` char to trigger tag autocompletion (#1192, #1189 - thanks @jimgraham)

## [0.22.0] - 2023-04-15

Fixes and Improvements:

- Added support for deep tag hierarchy in Tag Explorer panel (#1134, #1194)
- Consolidated and improved Backlinks, Placeholders and Orphans panels (#1196)
- Fixed note resolution when using template without defined path (#1197)

## [0.21.4] - 2023-04-14

Fixes and Improvements:

- Fixed issue with generated daily note template due to path escape (#1188, #1190)

## [0.21.3] - 2023-04-12

Fixes and Improvements:

- Fixed relative path from workspace root in templates (#1188)

## [0.21.2] - 2023-04-11

Fixes and Improvements:

- Fixed embed with relative paths (#1168, #1170)
- Improved multi-root folder support for daily notes (#1126, #1175)
- Improved use of tag completion (#1183 - thanks @jimgraham)
- Fixed relative path use in note creation when using templates (#1170)

Internal:

- Sync user docs with foam-template docs (#1180 - thanks @infogulch)

## [0.21.1] - 2023-02-24

Fixes and Improvements:

- Fixed note creation from placeholder (#1172)

## [0.21.0] - 2023-02-16

Features:

- Added support for filters for the `foam-vscode.open-resource` command (#1161)

## [0.20.8] - 2023-02-10

Internal:

- Updated most dependencies (#1160)

## [0.20.7] - 2023-01-31

Fixes and Improvements:

- Inform the user that directory renaming is not supported (#1143)
- Fixed extra `web` directory in published extension (#1152 - thanks @piousdeer)

## [0.20.6] - 2023-01-21

Fixes and Improvements:

- Updated minimum VS Code version to 1.70.0 (#1140)
- Fixed preview links with sections (#1135 - thanks @badsketch)
- Added setting for creating new notes in root or current dir (#1142)

## [0.20.5] - 2023-01-04

Fixes and Improvements:

- Fixed entry count in orphan, placeholder, tags-explorer panels (#1131 - thanks @badsketch)

## [0.20.4] - 2023-01-04

Fixes and Improvements:

- Added support for emoji tags (#1125 - thanks @badsketch)

## [0.20.3] - 2022-12-19

Fixes and Improvements:

- Show number of entries in title for orphan, placeholder, tag treeviews

## [0.20.2] - 2022-10-26

Fixes and Improvements:

- Creating new note uses default template when none is provided (#1094)

Internal:

- Changed matcher implementation to remove dependency on micromatch/glob
- Removed unnecessary dependencies and assets from extension

## [0.20.1] - 2022-10-13

Fixes and Improvements:

- Improved support for daily notes in multi root workspace (#1073)
- Create note from placeholder using template (#1061 - thanks @Dominic-DallOsto)
- Improved support for globs in multi root workspace (#1083)

## [0.20.0] - 2022-09-30

Features:

- Added `foam-vscode.create-note` command, which can be very customized for several use cases (#1076)

Fixes and Improvements:

- Removed `+` as a trigger char for date snippets
- Improved attachment support (#915)
- Improved error handling when starting Foam without an open workspace (#908)
- Added support for opening non-text files via wikilink (#915)
- Dataviz: now clicking is enough to open a link from the graph
- Dataviz: clicking on images/attachments will open them

## [0.19.5] - 2022-09-01

Fixes and Improvements:

- Added `FOAM_DATE_WEEK` variable (#1053 - Thanks @dmurph)
- Fixed extension inclusion when generating references for attachments
- Link completion label can be note title as well as path (#1059)
- Images and attachments are not shown by default in graph view (#1056)

## [0.19.4] - 2022-08-07

Fixes and Improvements:

- Fixed note embed in preview (#1052)

## [0.19.3] - 2022-08-04

Fixes and Improvements:

- Image embeds fixed in preview (#1036)

## [0.19.2] - 2022-08-04

Fixes and Improvements:

- Added support for angle markdown links (#1044)
- Filter out invalid file name chars when creating note (#1042)

Internal:

- Reorganized docs (#1031, thanks @infogulch)
- Fixed documentation links (#1046)
- Preview code refactoring

## [0.19.1] - 2022-07-11

Internal:

- Introduced cache for markdown parser (#1030)
- Various code refactorings

## [0.19.0] - 2022-07-07

Features:

- Support for attachments (PDF) and images (#1027)
- Support for opening day notes for other days as well (#1026, thanks @alper)

## [0.18.5] - 2022-06-29

Fixes and Improvements:

- Support for `alias` YAML property to define note alias (#1014 - thanks @lingyv-li)

Internal:

- Improved extension bundling (#1015 - thanks @lingyv-li)
- Use `vscode.workspace.fs` instead of `fs` (#1005 - thanks @joshdover)

## [0.18.4] - 2022-06-03

Fixes and Improvements:

- move past `]]` when writing wikilinks (#998 - thanks @Lauviah0622)
- highlight improvements (#890 - thanks @memeplex)

## [0.18.3] - 2022-04-17

Fixes and Improvements:

- Better reporting when links fail to resolve
- Failing link resolution during graph computation no longer fatal

## [0.18.2] - 2022-04-14

Fixes and Improvements:

- Fixed parsing error on empty direct links (#980 - thanks @chrisUsick)
- Improved rendering in preview of wikilinks that have link definitions (#979 - thanks @josephdecock)
- Restored handling of section-only wikilinks (#981)

## [0.18.1] - 2022-04-13

Fixes and Improvements:

- Fixed parsing error for direct links with square brackets in them (#977)
- Improved markdown direct link resolution (#972)
- Improved templates support for custom paths (#970)

## [0.18.0] - 2022-04-11

Features:

- Link synchronization on file rename

Internal:

- Changed graph computation on workspace change to simplify code

## [0.17.8] - 2022-04-01

Fixes and Improvements:

- Do not add ignored files to Foam upon change (#480)
- Restore full use of editor.action.openLink (#693)
- Minor performance improvements

## [0.17.7] - 2022-03-29

Fixes and Improvements:

- Include links with sections in backlinks (#895)
- Improved navigation when document editor is already open

## [0.17.6] - 2022-03-03

Fixes and Improvements:

- Don't fail on error when scannig workspace (#943 - thanks @develmusa)

## [0.17.5] - 2022-02-22

Fixes and Improvements:

- Added FOAM_SLUG template variable (#865 - Thanks @techCarpenter)

## [0.17.4] - 2022-02-13

Fixes and Improvements:

- Improvements to Foam variables in templates (#882 - thanks @movermeyer)
  - Foam variables can now be used just any other VS Code variables, including in combination with placeholders and transformers

## [0.17.3] - 2022-01-14

Fixes and Improvements:

- Fixed autocompletion with tags (#885 - thanks @memeplex)
- Improved "Open Daily Note" to be usabled in tasks (#897 - thanks @MCluck90)

## [0.17.2] - 2021-12-22

Fixes and Improvements:

- Improved support for wikilinks in titles (#878)
- Use syntax injection for wikilinks (#876 - thanks @memeplex)
- Fix when applying text edits in last line

Internal:

- DX: Clean up of testing setup (#881 - thanks @memeplex)

## [0.17.1] - 2021-12-16

Fixes and Improvements:

- Decorate markdown files only (#857)
- Fix template placeholders issue (#859)
- Improved replacement range for link completion

Internal:

- Major URI/path handling refactoring (#858 - thanks @memeplex)

## [0.17.0] - 2021-12-08

Features:

- Added first class support for sections (#856)
  - Sections can be referred to in wikilinks
  - Sections can be embedded
  - Autocompletion for sections
  - Diagnostic for sections
  - Embed sections

## [0.16.1] - 2021-11-30

Fixes and Improvements:

- Fixed diagnostic bug triggered when file had same suffix (#851)

## [0.16.0] - 2021-11-24

Features:

- Added support for unique wikilink identifiers (#841)
  - This change allows files that have the same name to be uniquely referenced as wikilinks
  - BREAKING CHANGE: wikilinks to attachments must now include the extension
- Added diagnostics for ambiguous wikilinks, with quick fixes available (#844)
- Added support for unique wikilinks in autocompletion (#845)

## [0.15.9] - 2021-11-23

Fixes and Improvements:

- Fixed filepath retrieval when creating note from template (#843)

## [0.15.8] - 2021-11-22

Fixes and Improvements:

- Re-enable link navigation for wikilinks (#840)

## [0.15.7] - 2021-11-21

Fixes and Improvements:

- Fixed template listing (#831)
- Fixed note creation from template (#834)

## [0.15.6] - 2021-11-18

Fixes and Improvements:

- Link Reference Generation is now OFF by default
- Fixed preview navigation (#830)

## [0.15.5] - 2021-11-15

Fixes and Improvements:

- Major improvement in navigation. Use link definitions and link references (#821)
- Fixed bug showing in hover reference the same more than once when it had multiple links to another (#822)

Internal:

- Foam URI refactoring (#820)
- Template service refactoring (#825)

## [0.15.4] - 2021-11-09

Fixes and Improvements:

- Detached Foam URI from VS Code URI. This should improve several path related issues in Windows. Given how core this change is, the release is just about this refactoring to easily detect possible side effects.

## [0.15.3] - 2021-11-08

Fixes and Improvements:

- Avoid delaying decorations on editor switch (#811 - thanks @memeplex)
- Fix preview issue when embedding a note and using reference definitions (#808 - thanks @pderaaij)

## [0.15.2] - 2021-10-27

Features:

- Added `FOAM_DATE_*` template variables (#781)

Fixes and Improvements:

- Dataviz: apply note type color to filter item label
- Dataviz: optimized rendering of graph to reduce load on CPU (#795)
- Preview: improved tag highlight in preview (#785 - thanks @pderaaij)
- Better handling of link reference definition (#786 - thanks @pderaaij)
- Link decorations are now enabled by default (can be turned off in settings)

## [0.15.1] - 2021-10-21

Fixes and Improvements:

- Improved filtering controls for graph (#782)
- Link Hover: Include other connected notes to link target

## [0.15.0] - 2021-10-04

Features:

- Preview on hover for wikilinks (#728 - thanks @JonasSprenger)
- Added tags and controls to graph dataviz (#737 - thanks @dannysemi)

Fixes and Improvements:

- Improved tags parsing (#708 - thanks @pderaaij)
- Fixed support for resources named like JS Object methods (#729 - thanks @JonasSprenger)

## [0.14.2] - 2021-07-24

Features:

- Autocompletion for tags (#708 - thanks @pderaaij)
- Use templates for new note created from wikilink (#712 - thanks @movermeyer)

Fixes and Improvements:

- Improved performance of initial file loading (#730 - thanks @pderaaij)

## [0.14.1] - 2021-07-14

Fixes and Improvements:

- Fixed NPE that would cause markdown preview to render incorrectly (#718 - thanks @pderaaij)

## [0.14.0] - 2021-07-13

Features:

- Create new note from selection (#666 - thanks @pderaaij)
- Use templates for daily notes (#700 - thanks @movermeyer)

Fixes and Improvements:

- Fixed for wikilink aliases in tables (#697 - thanks @pderaaij)
- Fixed link definition generation in presence of aliased wikilinks (#698 - thanks @pderaaij)
- Fixed template insertion of selected text (#701 - thanks @movermeyer)
- Fixed preview navigation (#710 - thanks @pderaaij)

## [0.13.8] - 2021-07-02

Fixes and Improvements:

- Improved handling of capitalization in wikilinks (#688 - thanks @pderaaij)
  - This update will make wikilinks with different capitalization, such as `[[wikilink]]` and `[[WikiLink]]` point to the same file. Please note that means that files that only differ in capitalization across the workspace would now be treated as having the same name
- Allow dots in wikilinks (#689 - thanks @pderaaij)
- Fixed a bug in the expansion of date snippets (thanks @syndenham-chorea)
- Added support for wikilink alias syntax, like `[[wikilink|label]]` (#689 - thanks @pderaaij)

## [0.13.7] - 2021-06-05

Fixes and Improvements:

- Fixed #667, incorrect resolution of foam-core library

Internal:

- BREAKING CHANGE: Removed Foam local plugins
  If you were previously using the alpha feature of Foam local plugins you will soon be able to migrate the functionality to the V1 API

## [0.13.6] - 2021-06-05

Fixes and Improvements:

- Fixed #667, incorrect resolution of foam-core library

## [0.13.5] - 2021-06-05

Fixes and Improvements:

- Improved support for nested tags (#661 - thanks @pderaaij)
- Allow YAML metadata in templates (#655 - thanks @movermeyer)
- Fixed template exclusion globs (#665)

## [0.13.4] - 2021-05-26

Fixes and Improvements:

- Added support for nested tags (#643 - thanks @pderaaij)
- Improved the flow of creating note from template (#645 - thanks @movermeyer)
- Fixed handling of title property in YAML (#647 - thanks @pderaaij and #546)

Internal:

- Updated various dependencies

## [0.13.3] - 2021-05-09

Fixes and Improvements:

- Improved Foam template variables resolution: unknown variables are now ignored (#622 - thanks @movermeyer)
- Fixed file matching in MarkdownProvider (#617)
- Fixed cancelling `Foam: Create New Note` and `Foam: Create New Note From Template` behavior (#623 - thanks @movermeyer)

## [0.13.2] - 2021-05-06

Fixes and Improvements:

- Fixed wikilink completion bug (#592 - thanks @RobinKing)
- Added support for stylable tags (#598 - thanks @Barabazs)
- Added "Create new note" command (#601 - thanks @movermeyer)
- Fixed navigation from placeholder and orphan panel (#600)

Internal:

- Refactored data model representation of resources: `Resource` (#593)

## [0.13.1] - 2021-04-21

Fixes and Improvements:

- fixed bug in Windows when running `Open Daily Note` command (#591 - Thanks @RobinKing)

## [0.13.0] - 2021-04-19

Features:

- Wikilink completion (#554)

Fixes and Improvements:

- fixed link navigation on path with spaces (#542)
- support for Chinese characters in tags (#567 - thanks @RobinKing)
- added support for `FOAM_TITLE` in templates (#549 - thanks @movermeyer)
- added configuration to enable/disable link navigation (#584)

## [0.12.1] - 2021-04-05

Fixes and Improvements:

- Link decorations are now optional (#558)
- Improved UX when creating notes from templates (#550 - thanks @movermeyer)

## [0.12.0] - 2021-03-22

Features:

- Launch daily note on startup (#501 - thanks @ingalles)
- Allow absolute directory in daily notes (#482 - thanks @movermeyer)
- Navigate wikilinks in Preview even without link definitions (#521)
- Workspace navigation (links and wikilinks) powered by Foam (#524)

Fixes and Improvements:

- Ignore directories that have .md extension (#533 - thanks @movermeyer)

## [0.11.0] - 2021-03-09

Features:

- Placeholders Panel: quickly see which placeholders and empty notes are in the workspace (#493 - thanks @joeltjames)
- Backlinks panel: now a Foam model powered backlinks panel (#514)

Fixes and Improvements:

- Dataviz: fixed graph node highlighting (#516, #517)

## [0.10.3] - 2021-03-01

Fixes and Improvements:

- Model: fixed wikilink resolution when using link definitions
- Templates: improved validation during template creation

## [0.10.2] - 2021-02-24

Fixes and Improvements:

- Templates: improved the flow of creating a new note from a template

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

Features:

- Foam logging can now be inspected in VsCode Output panel (#377)

Fixes and Improvements:

- Foam model: Fixed bug in tags parsing (#382)
- Dataviz: Graph canvas now resizes with window (#383, #375)
- Dataviz: Limit label length for placeholder nodes (#381)

## [0.7.0] - 2020-11-25

Features:

- Foam stays in sync with changes in notes
- Dataviz: Added multiple selection in graph (shift+click on node)

Fixes and Improvements:

- Dataviz: Graph uses VSCode theme colors
- Reporting: Errors occurring during foam bootstrap are now reported for easier debugging

## [0.6.0] - 2020-11-19

Features:

- Added command to create notes from templates (#115 - Thanks @ingalless)

Fixes and Improvements:

- Foam model: Fixed bug that prevented wikilinks from being slugified (#323 - thanks @SanketDG)
- Editor: Improvements in defaults for ignored files setting (thanks @jmg-duarte)
- Dataviz: Centering of the graph on note displayed in active editor (#319)
- Dataviz: Improved graph styling
- Dataviz: Added setting to cap the length of labels in the graph (thanks @jmg-duarte)
- Misc: Fixed problem with packaging icon in extension (#350 - thanks @litanlitudan)

## [0.5.0] - 2020-11-09

Features:

- Added tags panel (#311)

Fixes and Improvements:

- Date snippets now support configurable completion actions (#307 - thanks @ingalless)
- Graph now show note titles when zooming in (#310)
- New `foam.files.ignore` setting to exclude globs from being processed by Foam (#304 - thanks @jmg-duarte)
- Errors in YAML parsing no longer causes foam to crash (#320)
- Fixed error in CLI command janitor & migrate (#312 - thanks @hikerpig)

## [0.4.0] - 2020-10-28

Features:

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

Features:

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
