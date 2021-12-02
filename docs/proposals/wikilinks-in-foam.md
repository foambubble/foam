# Wikilinks in Foam

Foam supports standard wikilinks in the format `[[wikilink]]`.

Wikilinks can refer to any note or attachment in the repo: `[[note.md]]`, `[[doc.pdf]]`, `[[image.jpg]]`.

The usual wikilink syntax without extension refers to notes: `[[wikilink]]` and `[[wikilink.md]]` are equivalent.

The goal of wikilinks is to uniquely identify a file in a repo, no matter in which directory it lives.

Sometimes in a repo you can have files with the same name in different directories.
Foam allows you to identify those files using the minimum effort needed to disambiguate them.

This is achieved by adding as many directories above the file needed to uniquely identify the link, e.g. `[[house/todo]]`.

See below for more details.

## Goals for wikilinks in Foam

Wikilinks in Foam are meant to satisfy the following:
- make it easy for users to identify a resource
- make it interoperable with other similar note taking systems (Obsidian, Dendron, ...)
- be easy to get started with, but satisfy growing needs

## Types of wikilinks supported in Foam

Foam supports two types of keys inside a wikilink: a **path** reference and an **identifier** reference:

- `[[./file]]` and `[[../to/another/file]]` are **path** links to a resource, relative _from the source_
- `[[/path/to/file]]` is a **path** link to a resource, relative _from the repo root_
- `[[file]]` is an **identifier** of a resource (based on the filename)
- `[[path/to/file]]` is an **identifier** of a resource (based on the path), the same is true for `[[to/file]]`

It's important to note that sometimes identifier keys can't uniquely locale a resource.

A more concrete example will help:

```
/
  projects/
    house/
      todo.md
    buy-car/
      todo.md
      cars.md
  work/
    todo.md
    notes.md
```

In the above repo:

- `[[cars]]` is a unique identifier of a resource - it can be used anywhere in the repo
- `[[todo]]` is an non-unique identifier as it can refer to multiple resources
- `[[house/todo]]` is a unique identifier of a resource - it can be used anywhere in the repo
- `[[projects/house/todo]]` is a unique identifier of a resource - it can be used anywhere in the repo
- `[[/projects/house/todo]]` is a path reference to a resource
- `[[./todo]]` is a path reference to a resource (e.g. from `/projects/buy-car/cars.md`)

Basically we could say as a rule:

- if the link starts with `/` or `.` we consider it a **path** reference, in the first case from the repo root, otherwise from the source note
- if a link doesn't start with `/` or `.` it is an **identifier**
  - generally speaking we use the shortest identifier available to identify a resource, **but all are valid**
    - `[[projects/buy-car/cars]]`, `[[buy-car/cars]]`, `[[cars]]` are all unique identifier to the same resource, and are all valid in a document
    - the same can be said for `[[projects/house/todo]]` and `[[house/todo]]` - but not for `[[todo]]`, because it can refer to more than one resource

## Compatibility with other apps

| Scenario                    | Obsidian                        | Foam                            |
| --------------------------- | ------------------------------- | ------------------------------- |
| 1 `[[notes]]`               | ✔ unique identifier in repo     | ✔ unique identifier in repo     |
| 2 `[[/work/notes]]`         | ✔ valid path from repo root     | ✔ valid path from repo root     |
| 3 `[[work/notes]]`          | ✔ valid path from repo root     | ✔ valid identifier in repo      |
| 4 `[[project/house/todo]]`  | ✔ valid path from repo root     | ✔ valid unique identifier       |
| 5 `[[/project/house/todo]]` | ✔ valid path from repo root     | ✔ valid path from repo root     |
| 6 `[[house/todo]]`          | ✔ valid unique identifier       | ✔ valid unique identifier       |
| 7 `[[todo]]`                | ✘ ambiguous identifier          | ✘ ambiguous identifier          |
| 8 `[[/house/todo]]`         | ✘ incorrect path from repo root | ✘ incorrect path from repo root |

## Non-unique identifiers

We can't prevent non-unique identifiers from occurring in Foam (first and foremost because a file could be edited with another editor) but we can flag them. 

Therefore Foam follows the following strategy instead:

1. there is a clear resolution mechanism (alphabetic) so that if nothing changes a non-unique identifier will always return the same note. Resolution has to be deterministic
2. a diagnostic entry (warning or error) is showed to the user for non-unique identifiers, so she knows that she's using a "risky" identifier
   1. The quick resolution for this item will show the available unique identifiers matching the non-unique one

## Thanks 

Thanks to [@memplex](https://github.com/memeplex) for helping with the thinking around this proposal.