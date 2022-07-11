# Graph Visualization

Foam comes with a graph visualization of your notes.
To see the graph execute the `Foam: Show Graph` command.

## Graph Navigation

With the graph you can:

- highlight a node by hovering on it, to quickly see how it's connected to the rest of your notes
- select one or more (by keeping `shift` pressed while selecting) nodes by clicking on them, to better understand the structure of your notes
- navigate to a note by clicking on it while pressing `ctrl` or `cmd`
- automatically center the graph on the currently edited note, to immediately see its connections

## Custom Graph Styles

By default, the Foam graph will use the VS Code theme, but it's possible to customize it with the `foam.graph.style` setting.

A sample configuration object is provided below, you can provide as many or as little configuration as you wish:

```json
"foam.graph.style": {
    "background": "#202020",
    "fontSize": 12,
    "highlightedForeground": "#f9c74f",
    "node": {
        "note": "#277da1",
        "placeholder": "#545454",
        "feature": "green",
    }
}
```

- `note` defines the color for regular nodes
- `placeholder` defines the color for links that don't match any existing note. This is a [[placeholder]] because no file with such name exists (see [[wikilinks]] for more info).
- `feature` shows an example of how you can use note types to customize the graph. It defines the color for the notes of type `feature`
  - see [[note-properties]] for details
  - you can have as many types as you want
