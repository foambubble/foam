# Tags

Tags provide flexible categorization and organization for your notes beyond wikilinks and folders.

## Creating Tags

### Inline Tags

Add tags directly in note content:

```markdown
# Machine Learning Fundamentals

This covers basic algorithms and applications.

#machine-learning #data-science #algorithms #beginner
```

### Front Matter Tags

Add tags in YAML front matter:

```markdown
---
tags: [machine-learning, data-science, algorithms, beginner]
---
```

### Hierarchical Tags

Create tag hierarchies using forward slashes:

```markdown
#programming/languages/python
#programming/frameworks/react
#work/projects/website-redesign
#personal/health/exercise
```

## Autocompletion

Typing `#` shows existing tags. In front matter, use `Ctrl+Space` for tag suggestions.

## Tag Explorer

Use the Tag Explorer panel in VS Code's sidebar to:

- Browse hierarchical tag structure
- Filter by tag names
- Click tags to see all associated notes
- View tag usage counts
- Search for tags (click the search icon or use "Foam: Search Tag" command)

Tags also appear in the [[graph-view]] with customizable colors.

## Tag Search

Search for all occurrences of a tag across your workspace:

1. Use the command palette: "Foam: Search Tag"
2. Or click the search icon next to a tag in the Tag Explorer panel

Results appear in VS Code's search panel where you can navigate between matches.

> Known limitation: this command leverages VS Code's search capability, so it's constrained by its use of regular expressions. The search is best-effort and some false search results might show up.

## Custom Tag Styling

Customize tag appearance in markdown preview by adding CSS:

1. Create `.foam/css/custom-tag-style.css`
2. Add CSS targeting `.foam-tag` class:
   ```css
   .foam-tag {
     color: #ffffff;
     background-color: #000000;
   }
   ```
3. Update `.vscode/settings.json`:
   ```json
   {
     "markdown.styles": [".foam/css/custom-tag-style.css"]
   }
   ```

## Tags vs Backlinks

Some users prefer [[book]] backlinks instead of #book tags for categorization. Both approaches work - choose what fits your workflow.

[graph-view]: graph-view.md 'Graph Visualization'
