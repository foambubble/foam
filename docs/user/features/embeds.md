# Note Embeds

Embeds allow you to include content from other notes directly into your current note. This is powerful for creating dynamic content that updates automatically when the source note changes.

## Basic Syntax

Use the embed syntax with an exclamation mark before the wikilink:

```markdown
![[note-name]]
```

This will embed the entire content of `note-name` into your current note.

## Embedding Sections

You can embed specific sections of a note by referencing the heading:

```markdown
![[note-name#Section Title]]
```

## Embed Types

Foam supports different embedding scopes and styles that can be configured globally or overridden per embed.

### Scope Modifiers

- **`full`** - Include the entire note or section, including the title/heading
- **`content`** - Include everything except the title/heading

Examples:

```markdown
full![[my-note]] # Include title + content
content![[my-note]] # Content only, no title
```

### Style Modifiers

- **`card`** - Display the embedded content in a bordered container
- **`inline`** - Display the content seamlessly as part of the current note

Examples:

```markdown
card![[my-note]] # Bordered container
inline![[my-note]] # Seamless integration
```

### Combined Modifiers

You can combine scope and style modifiers:

```markdown
full-card![[my-note]] # Title + content in bordered container
content-inline![[my-note]] # Content only, seamlessly integrated
full-inline![[my-note]] # Title + content, seamlessly integrated
content-card![[my-note]] # Content only in bordered container
```

## Configuration

Set your default embed behavior in VS Code settings:

```json
{
  "foam.preview.embedNoteType": "full-card"
}
```

Available options:

- `full-card` (default)
- `full-inline`
- `content-card`
- `content-inline`

## Image Sizing

Resize images to make your documents more readable:

```markdown
![[image.png|300]]          # 300 pixels wide
![[image.png|50%]]          # Half the container width
```

### Common Use Cases

**Make large screenshots readable:**
```markdown
![[screenshot.png|600]]
```

**Create responsive images:**
```markdown
![[diagram.png|70%]]
```

**Size by width and height:**
```markdown
![[image.png|300x200]]
```

### Alignment

Center, left, or right align images:

```markdown
![[image.png|300|center]]
![[image.png|300|left]]
![[image.png|300|right]]
```

### Alt Text

Add descriptions for accessibility:

```markdown
![[chart.png|400|Monthly sales chart]]
```

### Units

- `300` or `300px` - pixels (default)
- `50%` - percentage of container
- `20em` - relative to font size

### Troubleshooting

- Check image path: `![[path/to/image.png|300]]`
- No spaces around pipes: `|300|` not `| 300 |`
- Images only resize in preview mode, not edit mode
- Use lowercase alignment: `center` not `Center`
