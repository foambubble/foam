# Footnotes

Footnotes let you add references or side notes to your writing without cluttering the main text.

## Writing Footnotes

Use standard Markdown footnote syntax:

```markdown
The study confirmed the hypothesis.[^1] Further work is needed.[^note]

[^1]: Smith et al., 2023, Journal of Examples.
[^note]: See the appendix for the full methodology.
```

Footnote IDs can be numbers or words. The definition can appear anywhere in the file — Foam finds it regardless of position.

## Navigation

Hover over a footnote reference like `[^1]` to see its definition inline.

Press `F12` (or `Ctrl+Click` / `Cmd+Click`) on a reference to jump to its definition in the file.

## Appearance

Footnote references are styled to match wikilinks — the `^id` text is colored and the brackets are hidden. In Preview, VS Code renders footnotes natively.

## Multiple References

You can reference the same footnote more than once:

```markdown
This point[^caveat] is elaborated elsewhere.[^caveat]

[^caveat]: See the companion article for full details.
```

## Related

- [[wikilinks]] - Linking between notes
- [[block-anchors]] - Linking to specific blocks within a note

[wikilinks]: wikilinks.md "Wikilinks"
[block-anchors]: block-anchors.md "Block Anchors"
