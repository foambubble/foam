# Note-Taking in Foam

Effective note-taking is the foundation of any knowledge management system. In Foam, you'll write notes in Markdown, a simple and powerful format that's both human-readable and widely supported. This guide will teach you everything you need to know about writing great notes in Foam.

## Markdown Basics

Markdown is a lightweight markup language that uses simple syntax to format text. Here are the essentials:

### Headings

```markdown
# Heading 1 (Main Title)

## Heading 2 (Major Section)

### Heading 3 (Subsection)

#### Heading 4 (Minor Section)
```

### Text Formatting

```markdown
**Bold text**
_Italic text_
**_Bold and italic_**
~~Strikethrough~~
`Inline code`
```

### Lists

```markdown
## Unordered Lists

- First item
- Second item
  - Nested item
  - Another nested item

## Ordered Lists

1. First step
2. Second step
   1. Sub-step
   2. Another sub-step
```

### Links and Images

```markdown
[External link](https://example.com)
![Image description](./assets/images/screenshot.png)
```

### Code Blocks

````markdown
```javascript
function greet(name) {
  return `Hello, ${name}!`;
}
```
````

### Tables

```markdown
| Column 1 | Column 2 | Column 3 |
| -------- | -------- | -------- |
| Data 1   | Data 2   | Data 3   |
| Data 4   | Data 5   | Data 6   |
```

### Quotes and Dividers

```markdown
> This is a quote or important note
> It can span multiple lines

---

Use three dashes for horizontal dividers
```

_[📹 Watch: Markdown syntax essentials for note-taking]_

## Foam-Specific Features

Beyond standard Markdown, Foam adds several powerful features:

### Wikilinks

Connect your notes with double brackets:

```markdown
I'm reading about [[Project Management]] and its relationship to [[Personal Productivity]].

This connects to [[2025-01-25-daily-note]] where I first had this insight.
```

### Note Embedding

Include content from other notes via [[embeds]]:

```markdown
![[Project Management#Key Principles]]

This embeds the "Key Principles" section from the Project Management note.
```

### Tags

Organize your content with [[tags]]:

```markdown
#productivity #learning #foam

Tags can be anywhere in your note and help with organization and filtering.
```

Use nested tags for better organization:

```markdown
#work/projects/website
#learning/programming/javascript
#personal/health/exercise
```

Those tags will show as a tree structure in the [Tag Explorer](../features/tags.md)

### Note Properties (YAML Front Matter)

Add metadata to your notes:

```markdown
---
title: 'Advanced Note-Taking Strategies'
tags: [productivity, learning, methods]
created: 2025-01-25
modified: 2025-01-25
status: draft
---

# Advanced Note-Taking Strategies

Your note content goes here...
```

## Writing Effective Notes

### The Atomic Principle

Each note should focus on one concept or idea:

**Good Example:**

```markdown
# The Feynman Technique

A learning method where you explain a concept in simple terms as if teaching it to someone else.

## Steps

1. Choose a topic to learn
2. Explain it in simple terms
3. Identify gaps in understanding
4. Simplify and use analogies

## Why It Works

- Forces active engagement with material
- Reveals knowledge gaps quickly
- Improves retention through teaching

Related: [[Active Learning]] [[Study Methods]]
```

**Avoid:**
Mixing multiple unrelated concepts in one note.

### Use Descriptive Titles

Your note titles should clearly indicate the content:

**Good:** `REST API Design Principles`
**Good:** `Meeting Notes - Product Roadmap Review 2025-01-25`
**Avoid:** `Stuff I Learned Today`
**Avoid:** `Notes`

### Link Generously

Don't hesitate to create links, even to notes that don't exist yet:

```markdown
# Machine Learning Fundamentals

Machine learning is a subset of [[Artificial Intelligence]] that focuses on creating algorithms that can learn from [[Data]].

Key concepts include:

- [[Supervised Learning]]
- [[Unsupervised Learning]]
- [[Neural Networks]]
- [[Feature Engineering]]

This connects to my work on [[Customer Behavior Analysis]] and [[Predictive Analytics]].
```

Foam will create placeholder pages for missing notes, making it easy to fill in knowledge gaps later.

## Keyboard Shortcuts

Essential VS Code shortcuts for note-taking:

| Shortcut                       | Action                |
| ------------------------------ | --------------------- |
| `Ctrl+N` / `Cmd+N`             | New file              |
| `Ctrl+S` / `Cmd+S`             | Save file             |
| `Ctrl+P` / `Cmd+P`             | Quick file open       |
| `Ctrl+Shift+P` / `Cmd+Shift+P` | Command palette       |
| `Ctrl+K V` / `Cmd+K V`         | Open Markdown preview |
| `Ctrl+[` / `Cmd+[`             | Decrease indent       |
| `Ctrl+]` / `Cmd+]`             | Increase indent       |
| `Alt+Z` / `Option+Z`           | Toggle word wrap      |

## What's Next?

Now that you understand note-taking basics:

1. **[[navigation]]** - Learn to move efficiently between notes with wikilinks
2. **[Explore the graph view](../features/graph-view.md)** - Visualize the connections in your knowledge base
3. **[Set up templates](../features/templates.md)** - Create reusable note structures
4. **[Use daily notes](../features/daily-notes.md)** - Establish a daily capture routine

[navigation]: navigation.md 'Navigation in Foam'
[tags]: ../features/tags.md 'Tags'

