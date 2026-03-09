# Block Anchors

Block anchors let you link to a specific paragraph, list item, heading, or blockquote within a note — not just to the note as a whole or to a section heading.

## Adding a Block Anchor

Place `^your-id` at the end of any block element. The ID can contain letters, numbers, and hyphens.

The `^id` marker is hidden in the preview — it's metadata, not visible text.

### Paragraph

```markdown
This is an important finding from the experiment. ^key-finding
```

Multi-line paragraphs work too — put the anchor at the end of the last line:

```markdown
The first measurements were inconclusive.
After repeating the experiment, results became clear. ^experiment-result
```

### List item

Place the anchor at the end of the item text. Foam anchors the entire item, including any sub-items:

```markdown
- Mix dry ingredients thoroughly ^dry-step
  - 2 cups flour
  - 1 tsp salt
- Add wet ingredients ^wet-step
```

### Heading

```markdown
## Methodology ^methodology
```

The anchor applies to the heading line itself, not the entire section below it.

### Blockquote

```markdown
> The only way to do great work is to love what you do. ^jobs-quote
```

## Linking to a Block

Use `[[note-name#^blockid]]` to link directly to a block:

```markdown
[[research-notes#^key-insight]]
[[research-notes#^list-ref]]
```

Foam provides autocomplete for block IDs when you type `#^` inside a wikilink.

You can also add display text:

```markdown
[[research-notes#^key-insight|See the key insight]]
```

## Embedding a Block

Use `![[note-name#^blockid]]` to embed just that block inline:

```markdown
![[research-notes#^key-insight]]
```

Only the referenced block's content is shown — not the entire note.

## Renaming a Block ID

Place your cursor on a `^blockid` anchor and press `F2` to rename it. Foam updates the anchor and all wikilinks that reference it across your workspace.

## Diagnostics

Foam warns you when a block link points to a `^id` that doesn't exist in the target note. A quick-fix lets you pick from the available block IDs.

If you accidentally use the same `^id` twice in one file, Foam flags the duplicate with a warning. A quick-fix replaces it with a freshly generated unique ID.

## Related

- [[wikilinks]] - General linking
- [[embeds]] - Embedding notes and blocks
