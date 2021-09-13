# Inclusion of notes Proposal <!-- omit in TOC -->

Currently it is not possible within Foam to include other notes into a note. Next to including a full note it could be interesting to add functionalities that allow for greater flexibility. This proposal discusses some functionalities around inclusion of notes.

**IMPORTANT: This design is merely a proposal of a design that could be implemented. It DOES NOT represent a commitment by `Foam` developers to implement the features outlined in this document. This document is merely a mechanism to facilitate discussion of a possible future direction for `Foam`.**

- [Introduction](#introduction)
- [New features](#new-features)
  - [Including a note](#including-a-note)
  - [Include a section of a note](#include-a-section-of-a-note)
  - [Include an attribute of a file (note property or frontmatter)](#include-an-attribute-of-a-file-note-property-or-frontmatter)

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
