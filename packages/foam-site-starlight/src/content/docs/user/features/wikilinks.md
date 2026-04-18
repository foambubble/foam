---
title: "Wikilinks"
description: "Published from /Users/riccardo/.codex/worktrees/a57a/foam/docs/user/features/wikilinks.md"
---
# Wikilinks

Wikilinks are internal links that connect files in your knowledge base using `[[double bracket]]` syntax.

## Creating Wikilinks

1. **Type `[[`** and start typing a note name
2. **Select from autocomplete** and press `Tab`
3. **Navigate** with `Ctrl+Click` (`Cmd+Click` on Mac) or `F12`
4. **Create new notes** by clicking on non-existent wikilinks

Example: [Graph Visualization](/user/features/graph-view)

## Placeholders

Wikilinks to non-existent files create [[placeholder]] links, styled differently to show they need files created. They're useful for planning your knowledge structure.

View placeholders in the graph with `Foam: Show Graph` command or in the `Placeholders` panel.

## Section Links

Link to specific sections using `[[note-name#Section Title]]` syntax. Foam provides autocomplete for section titles.

Examples:

- External file: `[link text](other-file.md#section-name)`
- Same document: `[link text](#section-name)`

## Block Links

Link to a specific paragraph, list item, heading, or blockquote using `[[note-name#^blockid]]` syntax. Add a `^your-id` anchor at the end of any block element, then reference it from other notes.

See [Block Anchors](/user/features/block-anchors) for full details.

## Directory Links

Linking to a folder name navigates to that folder's index file — either `index.md` or `README.md`. This works for both wikilinks and regular markdown links:

- `[[projects]]` → opens `projects/index.md` (or `projects/README.md`)
- `[Projects](projects)` → same
- `[Projects](projects/)` → trailing slash is ignored

If a file named `projects.md` exists alongside the `projects/` folder, it takes priority.

To disable this behavior, set `foam.links.directory.mode` to `disabled` in your VS Code settings.

## Link Syncing on Rename

When you rename or move a note or folder, Foam automatically updates all wikilinks pointing to it. This is enabled by default and can be turned off via the `foam.links.sync.enable` setting.

For standard markdown links (e.g. `[text](path/to/note.md)`), VS Code has a built-in feature that handles this. Enable it in VS Code settings: set `markdown.updateLinksOnFileMove.enabled` to `always` or `prompt`.

## Markdown Compatibility

Foam can automatically generate [Link Reference Definitions](/user/features/link-reference-definitions) at the bottom of files to make wikilinks compatible with standard Markdown processors.

## Related

- [Footnotes](/user/features/footnotes) - Adding references and side notes
- [Block Anchors](/user/features/block-anchors) - Linking to specific blocks within a note
- [Foam File Format](/dev/foam-file-format) - Technical details
- [Note Templates](/user/features/templates) - Creating new notes
- [Link Reference Definition Improvements](/dev/proposals/link-reference-definition-improvements) - Current limitations

[graph-visualization]: graph-visualization.md 'Graph Visualization'
[link-reference-definitions]: link-reference-definitions.md 'Link Reference Definitions'
[foam-file-format]: ../../dev/foam-file-format.md 'Foam File Format'
[note-templates]: templates.md 'Note Templates'
[link-reference-definition-improvements]: ../../dev/proposals/link-reference-definition-improvements.md 'Link Reference Definition Improvements'
[footnotes]: footnotes.md 'Footnotes'
[block-anchors]: block-anchors.md 'Block Anchors'


## Backlinks

- [Foam File Format](/dev/foam-file-format)
- [Foam Core](/dev/proposals/foam-core)
- [Foam Core](/dev/proposals/foam-core)
- [Link Reference Definition Improvements](/dev/proposals/link-reference-definition-improvements)
- [Roadmap](/dev/proposals/roadmap)
- [Using Foam](/user)
- [Block Anchors](/user/features/block-anchors)
- [Footnotes](/user/features/footnotes)
- [Graph Visualization](/user/features/graph-view)
- [Frequently Asked Questions](/user/frequently-asked-questions)
- [Recipes](/user/recipes/recipes)
