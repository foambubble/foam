# Coming from Obsidian

Good news: an Obsidian vault is, for the most part, already a Foam workspace. Both store your notes as plain Markdown files in a directory, so in most cases you can just open your vault folder in VS Code with the Foam extension installed and start working.

## Try it in 30 seconds

1. Install the [Foam extension](https://marketplace.visualstudio.com/items?itemName=foam.foam-vscode) in VS Code.
2. **File → Open Folder…** and pick your existing Obsidian vault.
3. That's it — wikilinks, backlinks, the graph, and tags should all work.

You can keep using Obsidian on the same folder side-by-side. Foam doesn't change your files unless you ask it to.

## What works the same

| Obsidian              | Foam                |
| --------------------- | ------------------- |
| `[[wikilinks]]`       | [[wikilinks]]       |
| `![[embeds]]`         | [[embeds]]          |
| `[[note#^block-id]]`  | [[block-anchors]]   |
| Backlinks panel       | [[backlinking]]     |
| Graph view            | [[graph-view]]      |
| Daily notes           | [[daily-notes]]     |
| Templates             | [[templates]]       |
| Tags (`#tag`)         | [[tags]]            |
| Frontmatter / aliases | [[note-properties]] |

## What's different or missing

These are the things most likely to surprise you:

- **Live preview / WYSIWYG editing.** Foam uses VS Code's standard split editor + preview pane rather than inline rendering.
- **Community plugins.** Obsidian plugins don't run in Foam. Foam relies on the wider VS Code extension ecosystem instead — see [[recommended-extensions]].
- **Canvas.** Not supported (tracked in [#1450](https://github.com/foambubble/foam/issues/1450)).
- **Tasks plugin syntax.** Not supported (tracked in [#1466](https://github.com/foambubble/foam/issues/1466)).
- **Callouts / Admonitions** (`> [!note]`). Not rendered natively; works as a normal blockquote.
- **Wikilink resolution.** Foam and Obsidian agree on most cases but resolve identifier-style links slightly differently. See the comparison table in [[wikilinks]].

## A few practical tips

- **`.obsidian/` folder.** Leave it alone if you're keeping both tools. Add it to `.gitignore` if you only want to track notes.
- **Templates.** Foam templates live in `.foam/templates/` — see [[templates]] for the format.
- **Don't see something here?** Search [open issues](https://github.com/foambubble/foam/issues) — chances are someone has already asked.

## Related

- [[wikilinks]] — full link syntax reference
- [[first-workspace]] — set up Foam from scratch
- [[recommended-extensions]] — VS Code extensions that pair well with Foam

[wikilinks]: ../features/wikilinks.md 'Wikilinks'
[embeds]: ../features/embeds.md 'Note Embeds'
[block-anchors]: ../features/block-anchors.md 'Block Anchors'
[backlinking]: ../features/backlinking.md 'Backlinking'
[graph-view]: ../features/graph-view.md 'Graph Visualization'
[daily-notes]: ../features/daily-notes.md 'Daily Notes'
[templates]: ../features/templates.md 'Note Templates'
[tags]: ../features/tags.md 'Tags'
[note-properties]: ../features/note-properties.md 'Note Properties'
[recommended-extensions]: ../getting-started/recommended-extensions.md 'Recommended Extensions'
[first-workspace]: ../getting-started/first-workspace.md 'Creating Your First Workspace'

