# Navigation in Foam

Navigation is where Foam truly shines. Unlike traditional file systems or notebooks, Foam lets you move through your knowledge by following connections between ideas. This guide will teach you how to navigate efficiently using wikilinks, backlinks, and other powerful features.

_[📹 Watch: Mastering navigation in Foam]_

## Understanding Wikilinks

Wikilinks are the backbone of Foam navigation. They connect your thoughts and let you jump between related concepts instantly.

### Basic Wikilink Syntax

```markdown
I'm learning about [[Machine Learning]] and its applications in [[Data Science]].

This reminds me of my notes on [[Python Programming]] from yesterday.
```

When you type `[[`, Foam shows you a list of existing notes to link to. If the note doesn't exist, Foam creates a placeholder that you can click to create the note later.

### Wikilink Variations

**Link to a specific heading:**

```markdown
See the [[Project Management#Risk Assessment]] section for details.
```

**Link to a specific block:**

```markdown
See the [[Project Management#^block-id]] paragraph for details.
```

**Link with alias:**

```markdown
According to [[Einstein, Albert|Einstein]], imagination is more important than knowledge.
```

### Autocomplete and Link Assistance

Foam provides intelligent autocomplete when creating links:

1. **Type `[[`** - Foam shows a dropdown of existing notes
2. **Start typing** - The list filters to matching notes
3. **Use arrow keys** to navigate suggestions
4. **Press Enter** to insert the selected link

## The Foam Graph

For a visual overview of your knowledge base, Foam offers a [[graph-view]]. This feature renders your notes as nodes and the links between them as connections, creating an interactive map of your thoughts.

_[📹 Watch: Navigation with the Foam Graph]_

### Using the Graph

1.  **Open the Command Palette** (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2.  **Run the "Foam: Show Graph" command**
3.  The graph will open in a new panel. You can:

- **Click on a node** to navigate to that note.
- **Pan and zoom** to explore different areas of your knowledge base.
- **See how ideas cluster** and identify central concepts.

## Backlinks: The Power of Reverse Navigation

Backlinks show you which notes reference the current note. This creates a web of knowledge where ideas naturally connect.

### Viewing Backlinks

1. **Open any note**
2. **Look for the "Connections" panel** in the sidebar
3. **See all notes that link to your current note**
4. **Click any backlink** to jump to that note

## Quick Navigation Features

### Command Palette Navigation

Press `Ctrl+Shift+P` / `Cmd+Shift+P` and try these commands:

- **"Foam: Open Random Note"** - Discover forgotten knowledge
- **"Foam: Open Daily Note"** - Quick access to today's notes
- **"Go to File"** (`Ctrl+P` / `Cmd+P`) - Fast file opening
- **"Go to Symbol"** (`Ctrl+Shift+O` / `Cmd+Shift+O`) - Jump to headings within a note

### File Explorer Integration

The VS Code file explorer shows your note structure:

- **Click any `.md` file** to open it
- **Use the search box** to filter files
- **Right-click** for context menus (rename, delete, etc.)

Foam also supports the Note Explorer, which is like the file explorer, but centered around the Foam metadata.

### Quick Open

Press `Ctrl+P` / `Cmd+P` and start typing:

- **File names** - `machine` finds "machine-learning.md"
- **Partial paths** - `daily/2025` finds daily notes from 2025
- **Recent files** - Empty search shows recently opened files

## Link Management and Maintenance

### Finding Broken Links - Placeholders

In Foam broken links are considered placeholders for future notes.
Placeholders (references to non-existent notes) appear differently:

- In editor: `[[missing-note]]` will be highlighted a different color
- In preview: Shows as regular text or with special styling

Clicking on a placeholder in the editor will create the corresponding note.

**To find all placeholders:**

You can find placeholders by looking at the `Placeholders` treeview.

### Renaming and Moving Notes

When you rename a note file:

1. **Use VS Code's rename function** (`F2` key)
2. **Foam automatically updates** all links to that note
3. **Check the "Problems" panel** for any issues

Currently you cannot rename whole folders.

## What's Next?

With navigation mastered, you're ready to:

1. **[Explore the graph view](../features/graph-view.md)** - Visualize your knowledge network
2. **[Learn about backlinks](../features/backlinking.md)** - Master bidirectional linking
3. **[Set up templates](../features/templates.md)** - Standardize your note creation
4. **[Use tags effectively](../features/tags.md)** - Add another layer of organization
