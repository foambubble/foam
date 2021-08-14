# Inclusion of notes Proposal <!-- omit in TOC -->

Currently it is not possible within Foam to include other notes into a note. Next to including a full note it could be interesting to add functionalities that allow for greater flexibility. This proposal discusses some functionalities around inclusion of notes.

**IMPORTANT: This design is merely a proposal of a design that could be implemented. It DOES NOT represent a commitment by `Foam` developers to implement the features outlined in this document. This document is merely a mechanism to facilitate discussion of a possible future direction for `Foam`.**

- [Introduction](#introduction)
- [New features](#new-features)
  - [Including a note](#including-a-note)
  - [Include a section of a note](#include-a-section-of-a-note)
  - [Include an attribute of a file (note property or frontmatter)](#include-an-attribute-of-a-file-note-property-or-frontmatter)
  - [Inclusion of backlinks overview](#inclusion-of-backlinks-overview)
  - [Introducing a query language](#introducing-a-query-language)

## Introduction

Initial work and thought on including a note was ignited by issue [#652](https://github.com/foambubble/foam/issues/652). Requested by a user was a likewise functionality as offered in Obsidian. This was simply the ability to include a note.

Whilst researching digital gardening for my own setup, I came across an in-depth overview by [Maggie Appleton](https://maggieappleton.com/roam-garden). Showing examples of her personal Roam Research I see valuable possibilites to connect more information, if we would add additional functionalities to the possibility of including a note. This proposal displays these possible functionalities and markup.

## New features

### Including a note

The minimal functionality is the ability to fully include a note. Markup used in Obsidian for this is `![[wikilink]]`. For Foam I would suggest to follow this syntax. Benefits being:

- Adds minimal amount of knowledge required as syntax is based on the syntax of creating a wikilink.
- Makes the auto-complete work ouf-of-the-box, without any additional code and listeners required.

**Important**. A risk exists that a loop of including the same notes arises. E.g. Note A includes note B which includes note A. This needs to be prevented by the implementation and made visible to the user.

### Include a section of a note

It could be interesting to only include a section of a note instead of the entire note. In order to do so thse user should be able to use the following syntax:

`![[wikilink#section-b]]`

As a result it will include the section title + section content until the next section *or* end of file.

### Include an attribute of a file (note property or frontmatter)

As a user I could be interested in collecting the value of any given proeprty for a note. For example, I might want to include the tags as defined in the frontmatter of note A. This should be possible via the syntax:

`![[wikilink:<property>]]`

The property value should be lookedup by foam defined properties, e.g. title, **or** any property defined in the frontmatter of a note.

So, the example of including the tags of a note should be:

`![[wikilink:tags]]`

### Inclusion of backlinks overview

It could be interesting to easily display the backlinks of a note in the preview, rather then using the custom window foam provides. If an user wants to easily see, or perhaps format, the references of that note this could be an option.

A syntax could look like:

`!{{note-backlinks}}`

But, syntax is something to think about.

### Introducing a query language

Roam Research has the concept of a custom [query language](https://roamresearch.com/#/app/help/page/Gx35Ef0-S). This query language allows for interesting functionalities. For example, let me find all the notes that contain note a and note b:

`{{query: { and: [[Note A]], [[Note B]] }}}`

Interestingly using the `wikilink` format in this language would allow the autocomplete to be used. Making life a bit simpler to define these queries. 

Combining this with the feature of [including a property](#include-an-attribute-of-a-file-note-property-or-frontmatter) you could use this to display additional information to the note. For example: let me find all titles of the notes that have the tag `foam`.

`{{query: { tags: ['foam'] , display: 'title'}}`

Could lead to the display of:

```md
- [[Note A]] 
- [[Note B]]
```

Or if you only want to count:

`{{query: { tags: ['foam'] , display: 'count'}}`

could display

```md
Found 2 notes with the tags: ['foam']
```

or just a number: `2`

