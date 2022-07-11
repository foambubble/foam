---
type: feature
keywords: hello world
---

# Note Properties

At the top of the file you can have a section where you define your properties.

> Be aware that this section needs to be at the very top of the file to be valid

For example, for this file, we have:

```text
---
type: feature
keywords: hello world
---
```

Those are properties.
Properties can be used to organize your notes.

## Special Properties

Some properties have special meaning for Foam:

- the `title` property will assign the name to the note that you will see in the graph, regardless of the filename or the first heading (also see how to [[write-notes-in-foam]])
- the `type` property can be used to style notes differently in the graph (also see [[graph-visualization]])
- the `tags` property can be used to add tags to a note (see [[tags-and-tag-explorer]])
