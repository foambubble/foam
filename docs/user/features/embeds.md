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
