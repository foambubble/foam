# Writing Notes

Notes are simple text files with some extra flavor, in the shape of Markdown syntax and support for extra properties (see [[note-properties]]).

## Foam Syntax

Foam uses standard Markdown, with a few added twists:

- the title of a note (e.g. in the [[graph-visualization]]) is given by precedence based on:
  - the `title` property (see [[note-properties]])
  - the first `# heading 1` of the file
  - the file name

## Markdown Syntax

With Markdown, we can style our notes in a simple way, while keeping the document a simple text file (the best way to future-proof your writings!).

You can see the formatted output by running the `Markdown: Open Preview to the Side` command.

Here is a high level overview of Markdown, for more information on the Markdown syntax [see here](https://commonmark.org/help/).

# Heading 1

## Heading 2

### Heading 3

#### Heading 4

##### Heading 5

###### Heading 6

This is a [link to google](https://www.google.com).

This is a wikilink (aka internal link) to [[note-properties]].

Here is an image:
![image](../../attachments/foam-icon.png)

> this is a blockquote
> it can span multiple lines

- list item
- list item
- list item

1. One
2. Two
3. Three

This text is **in bold** and this is *italic*.

The following is a horizontal rule

---

This is a table:
| Column 1 | Column 2 |
| -------- | -------- |
| R1C1     | R1C2     |
| R2C1     | R2C2     |

You can `inline code` or

```text
you can create
code blocks
```
