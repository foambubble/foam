---
tags: my-tag1 my-tag2
---

# Tags

You can add tags to your notes to categorize or link notes together.

## Creating a tag

There are two ways of creating a tag:

- Adding a `#tag` anywhere in the text of the note, for example: #my-tag1
- Using the `tags: tag1, tag2` yaml frontmatter [[note property|note-properties]]. Notice `my-tag1` and `my-tag2` tags which are added to this document this way.

Tags can also be hierarchical, so you can have `#parent/child`.

## Using *Tag Explorer*

It's possible to navigate tags via the Tag Explorer panel.
In the future it will be possible to explore tags via the graph as well.

## Styling tags

Inline tags can be styled using custom CSS with the selector `.foam-tag`.

## Using backlinks in place of tags

Given the power of backlinks, some people prefer to use them as tags.
For example you can tag your notes about books with [[book]].
