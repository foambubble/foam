# Query language for Foam <!-- omit in TOC -->

Currently the linkage between notes is rather static. By defining wikilinks in a note relationships are established. Or one could use tags to categorise a collection of notes. However, this collection of notes for a tag can't be used in a note itself. This proposal proposes an option to dyanmically collect a collection of notes, utilising a foam specific query language. Inspired by the functionality of Roam Research.

**IMPORTANT: This design is merely a proposal of a design that could be implemented. It DOES NOT represent a commitment by `Foam` developers to implement the features outlined in this document. This document is merely a mechanism to facilitate discussion of a possible future direction for `Foam`.**

- [Introduction](#introduction)
- [New features](#new-features)
  - [Finding a collection of notes that hold a reference to the note](#finding-a-collection-of-notes-that-hold-a-reference-to-the-note)
  - [Conditional search queries](#conditional-search-queries)
  - [Control the display of found results](#control-the-display-of-found-results)
  - [Query properties of a note](#query-properties-of-a-note)

## Introduction

Roam Research has the concept of a custom [query language](https://roamresearch.com/#/app/help/page/Gx35Ef0-S). This query language allows for interesting functionalities. For example, let me find all the notes that contain note a and note b:

`{{query: { and: [[Note A]], [[Note B]] }}}`

Whilst researching digital gardening for my own setup, I came across an in-depth overview by [Maggie Appleton](https://maggieappleton.com/roam-garden). Showing examples of her personal Roam Research I see valuable possibilites to connect more information, if we would add additional functionalities to the possibility of including a note. This proposal displays these possible functionalities and markup.

## New features

### Finding a collection of notes that hold a reference to the note

A simple query could be to find all the notes that have a reference to a note. For example, find me all notes that have a wikilink `[[inbox]]`. To query this one types:

```md
{{query: [[inbox]] }}
```

The semantics here being that a wikilink automatically refers to a note. As such it is not necessary to specifically add a prefix as title. This is to reduce verbosity and complexity of a query. If we would like to make this specific it could become something as:

```md
{{ query: {title: inbox} }}
```

Displaying of the results could be:

```md
- [[Note A]] 
- [[Note B]]
```

### Conditional search queries

An use case could be to find all notes that hold a reference to multiple notes, or at least one of the defined notes. As such, conditional search queries should be possible. For this proposal it is suggested to allow `AND`, `OR` and `NOT` conditions for now. 

Finding all notes that reference `inbox` and `todo` would then lead to the query:

```md
{{query: {and: [[inbox]], [[todo]] } }}
```

*Note*: Roam research does not divide the different notes by a `,`. I am not sure what the wisest thing to do is here taking into account cognitive load for the users and performance of the query language. To be researched.

### Control the display of found results

Combining this with the feature of [including a property](#include-an-attribute-of-a-file-note-property-or-frontmatter) you could use this to display additional information to the note. For example: let me find all titles of the notes that have the tag `foam`.

`{{query: { and: [[inbox]], [[todo]] }, display: 'title'}}`

Could lead to the display of:

```md
- [[Note A]] 
- [[Note B]]
```

Or if you only want to count:

`{{query: {and: [[inbox]], [[todo]] }, display: 'count' }}`

could display

```md
Found 2 notes with the tags: ['foam']
```

or just a number: `2`

### Query properties of a note

Rather then just querying wikilinks, users might want to query on other note properties as well. For example on tags, custom properties or date ranges.

For example, one might want to collect all note titles that have the tag `draft`. The query might become:

```md
{{query: { tags: ['draft'] }, display: 'count'}}
```
