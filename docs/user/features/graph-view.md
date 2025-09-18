# Graph Visualization

The graph view is one of Foam's most powerful features. It transforms your collection of notes into a visual network, revealing connections between ideas that might not be obvious when reading individual notes. This guide will teach you how to use the graph view to explore, understand, and expand your knowledge base.

To see the graph execute the `Foam: Show Graph` command.

Your files, such as notes and documents, are shown as the nodes of the graph along with the tags defined in your notes. The edges of the graph represent either a link between two files or a file that contains a certain tag. A node in the graph will grow in size with the number of connections it has, representing stronger or more defined concepts and topics.

### The `Show Graph` command

1. **Press `Ctrl+Shift+P` / `Cmd+Shift+P`**
2. **Type "Foam: Show Graph"**
3. **Press Enter**

You can set up a custom keyboard shortcut:

1. **Go to File > Preferences > Keyboard Shortcuts**
2. **Search for "Foam: Show Graph"**
3. **Assign your preferred shortcut**

## Graph Navigation

With the Foam graph visualization you can:

- highlight a node by hovering on it, to quickly see how it's connected to the rest of your notes
- select one or more (by keeping `shift` pressed while selecting) nodes by clicking on them, to better understand the structure of your notes
- navigate to a note by clicking on it's node while pressing `ctrl` or `cmd`
- automatically center the graph on the currently edited note, to immediately see its connections

## Filter View

If you only wish to view certain types of notes or tags, or want to hide linked attachment nodes then you can apply filters to the graph.

- Open the graph view using the `Foam: Show Graph` command
- Click the button in the top right corner of the graph view that says "Open Controls"
- Expand the "Filter By Type" dropdown to view the selection of types that you can filter by
- Uncheck the checkbox for any type you want to hide
- The types displayed in this dropdown are defined by [[note-properties]] which includes Foam-standard types as well as custom types defined by you!

![Graph filtering demo](../../assets/images/graph-filter.gif)

## Custom Graph Styles

The Foam graph will use the current VS Code theme by default, but it's possible to customize it with the `foam.graph.style` setting.

![Graph style demo](../../assets/images/graph-style.gif)

A sample configuration object is provided below, you can provide as many or as little configuration as you wish:

```json
"foam.graph.style": {
    "background": "#202020",
    "deduplication": false,
    "fontSize": 12,
    "fontFamily": "Sans-Serif",
    "lineColor": "#277da1",
    "lineWidth": 0.2,
    "particleWidth": 1.0,
    "highlightedForeground": "#f9c74f",
    "node": {
        "note": "#277da1",
    }
}
```

- `background` background color of the graph, adjust to increase contrast
- `deduplication` indicating whether to remove duplicate links between nodes
- `fontSize` size of the title font for each node
- `fontFamily` font of the title font for each node
- `lineColor` color of the edges between nodes in the graph
- `lineWidth` thickness of the edges between nodes
- `particleWidth` size of the particle animation showing link direction when highlighting a node
- `highlightedForeground` color of highlighted nodes and edges when hovering over a node
- to style individual types of nodes jump to the next section: [Style Nodes By Type](#style-nodes-by-type)

### Style Nodes by Type

It is possible to customize the style of a node based on the `type` property in the YAML frontmatter of the corresponding document.

There are a few default node types defined by Foam that are displayed in the graph:

- `note` defines the color for regular nodes whose documents have not overridden the `type` property.
- `placeholder` defines the color for links that don't match any existing note. This is a [[placeholder]] because no file with such name exists.
  - see [[wikilinks]] for more info <!--NOTE: this placeholder link should NOT have an associated file. This is to demonstrate the custom coloring-->
- `tag` defines the color for nodes representing #tags, allowing tags to be used as graph nodes similar to backlinks.
  - see [[tags]] for more info
- `feature` shows an example of how you can use note types to customize the graph. It defines the color for the notes of type `feature`
  - see [[note-properties]] for details

For example the following `backlinking.md` note:

```markdown
---
type: feature
---
# Backlinking

...
```

And the following `settings.json`:

```json
"foam.graph.style": {
    "background": "#202020",
    "node": {
        "note": "#277da1",
        "placeholder": "#545454",
        "tag": "#f9c74f",
        "feature": "red",
    }
}
```

Will result in the following graph:

![Style node by type](../../assets/images/style-node-by-type.png)

## What's Next?

With graph view mastery, you're ready to explore advanced Foam features:

1. **[[wikilinks]]** - Understand bidirectional connections
2. **[[templates]]** - Use templates effectively to standardize your note creation
3. **[[tags]]** - Organize your notes with tags
4. **[[daily-notes]]** - Set up daily notes to establish capture routines

[//begin]: # "Autogenerated link references for markdown compatibility"
[note-properties]: note-properties.md "Note Properties"
[wikilinks]: wikilinks.md "Wikilinks"
[tags]: tags.md "Tags"
[templates]: templates.md "Note Templates"
[daily-notes]: daily-notes.md "Daily Notes"
[//end]: # "Autogenerated link references"
