# Wikilinks

Wikilinks are internal links that connect files in your knowledge base using `[[double bracket]]` syntax.

## Creating Wikilinks

1. **Type `[[`** and start typing a note name
2. **Select from autocomplete** and press `Tab`
3. **Navigate** with `Ctrl+Click` (`Cmd+Click` on Mac) or `F12`
4. **Create new notes** by clicking on non-existent wikilinks

Example: [[graph-view]]

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

See [[block-anchors]] for full details.

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

Foam can automatically generate [[link-reference-definitions]] at the bottom of files to make wikilinks compatible with standard Markdown processors.

## Related

- [[block-anchors]] - Linking to specific blocks within a note
- [[foam-file-format]] - Technical details
- [[templates]] - Creating new notes
- [[link-reference-definition-improvements]] - Current limitations

[graph-visualization]: graph-visualization.md 'Graph Visualization'
[link-reference-definitions]: link-reference-definitions.md 'Link Reference Definitions'
[foam-file-format]: ../../dev/foam-file-format.md 'Foam File Format'
[note-templates]: templates.md 'Note Templates'
[link-reference-definition-improvements]: ../../dev/proposals/link-reference-definition-improvements.md 'Link Reference Definition Improvements'
[block-anchors]: block-anchors.md 'Block Anchors'
