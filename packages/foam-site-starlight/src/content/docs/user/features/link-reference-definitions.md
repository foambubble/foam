---
title: "Link Reference Definitions"
description: "Published from /Users/riccardo/.codex/worktrees/a57a/foam/docs/user/features/link-reference-definitions.md"
---
# Link Reference Definitions

Link reference definitions make your notes compatible with standard Markdown processors by converting wikilinks to standard Markdown references.

Foam doesn't need references in order to work, but this feature is aimed at supporting other tools you might want to integrate with.

## What Are Link Reference Definitions?

Foam can automatically add reference definitions to the bottom of your notes:

**Your note:**

```markdown
# Machine Learning

Related to [[Data Science]] and [[Statistics]].
```

**With reference definitions:**

```markdown
# Machine Learning

Related to [[Data Science]] and [[Statistics]].

[Data Science]: data-science.md 'Data Science'
[Statistics]: statistics.md 'Statistics'
```

## Enabling Reference Definitions

Configure in your settings:

```json
{
  "foam.edit.linkReferenceDefinitions": "withExtensions"
}
```

**Options:**

- `"off"` - Disabled (default)
- `"withoutExtensions"` - References without extension
- `"withExtensions"` - References with extension

If you are using your notes only within Foam, you can keep definitions `off` (also to reduce clutter), otherwise pick your setting based on what is required by your use case.

## How It Works

1. Scans your note for wikilinks
2. Generates reference definitions when you save
3. Updates definitions when links change
4. Maintains the auto-generated section

## Benefits

- **Standard Markdown compatibility** - Works with any Markdown processor
- **Publishing platforms** - Compatible with GitHub Pages, Jekyll, etc.
- **Future-proofing** - Not locked into Foam-specific format
- **Team collaboration** - Others can read notes without Foam


## Backlinks

- [Developing documentation](/dev/about-docs)
- [Foam Core](/dev/proposals/foam-core)
- [Foam Core](/dev/proposals/foam-core)
- [Link Reference Definition Improvements](/dev/proposals/link-reference-definition-improvements)
- [Link Reference Definition Improvements](/dev/proposals/link-reference-definition-improvements)
- [Roadmap](/dev/proposals/roadmap)
- [Using Foam](/user)
- [Wikilinks](/user/features/wikilinks)
- [Publish to GitHub](/user/publishing/publish-to-github)
- [Janitor](/user/tools/workspace-janitor)
