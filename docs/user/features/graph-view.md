# Graph Visualization

The graph view transforms your notes into a visual network, revealing connections between ideas. To open it, run the `Foam: Show Graph` command.

Files and tags appear as nodes; links between files and file-to-tag relationships are the edges. A node grows in size with the number of connections it has.

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

### Preview Mode

By default, clicking a node opens the source file in the editor. To open the markdown preview instead, enable the `foam.graph.navigateToPreview` setting:

```json
"foam.graph.navigateToPreview": true
```

This gives you a two-panel layout — graph on one side, rendered preview on the other — without a source editor in between. Non-markdown files (attachments, images, etc.) always open in the editor regardless of this setting.

## Groups

The **Groups** panel (top-right of the graph) controls which nodes are visible and how they are colored. It has three parts:

**Color by** — sets the default coloring strategy for nodes:

- `None` — each node type gets its own color
- `Type` — colors by the note's `type` frontmatter property
- `Directory` — colors by the directory the file lives in

**Built-in types** — checkboxes and color dots for `tag`, `attachment`, `image`, and `placeholder` nodes. Uncheck to hide, click the colored dot to change the color.

**Custom groups** — rules you define to color (and optionally hide) a subset of notes. Each group matches notes by a property and assigns a color. Click `+ Add group` to create one.

A group matches notes by:

- `type` — exact match on the note's type (e.g. `project`)
- `path` — substring match on the file path (e.g. `journal`)
- `tag` — exact match on a tag (e.g. `daily`)
- `title` — substring match on the note title
- Any frontmatter key — exact match on a custom property

Use `/regex/` syntax for pattern matching: e.g. `/^2024/` matches paths starting with `2024`.

Groups layer on top of the default coloring — last matching group wins. Unchecking a group hides notes that only belong to that group.

## Named Views

Define pre-configured graph views in `foam.graph.views`. A view named **`"Default"`** is applied automatically whenever the graph opens — use it to set your preferred starting configuration.

```json
"foam.graph.views": [
  {
    "name": "Default",
    "colorBy": "directory",
    "show": {
      "tag": { "enabled": false },
      "placeholder": { "enabled": false }
    }
  },
  {
    "name": "Journal",
    "colorBy": "directory",
    "show": {
      "tag": { "enabled": false },
      "placeholder": { "enabled": false }
    },
    "groups": [
      {
        "id": "journal",
        "label": "path=journal",
        "color": "#6bcb77",
        "enabled": true,
        "match": { "property": "path", "value": "journal" }
      }
    ]
  }
]
```

Open a named view via a keybinding in `keybindings.json`:

```json
{
  "key": "ctrl+shift+j",
  "command": "foam-vscode.show-graph",
  "args": { "view": "Journal" }
}
```

You can also pass a config inline without a named view:

```json
{
  "key": "ctrl+shift+g",
  "command": "foam-vscode.show-graph",
  "args": {
    "config": {
      "colorBy": "type",
      "show": { "placeholder": { "enabled": false } }
    }
  }
}
```

**View config fields:**

| Field        | Description                                                                            |
| ------------ | -------------------------------------------------------------------------------------- |
| `name`       | Display name shown in the panel title. Use `"Default"` to apply automatically on open. |
| `colorBy`    | `"none"`, `"directory"`, or `"type"`                                                   |
| `groups`     | Array of custom group rules (see Groups section above)                                 |
| `show`       | Per built-in type config: `{ "tag": { "enabled": true, "color": "#ff0000" } }`         |
| `background` | Background color override                                                              |
| `fontSize`   | Font size override                                                                     |
| `fontFamily` | Font family override                                                                   |
| `lineColor`  | Edge color override                                                                    |

All fields are optional. When both `view` and `config` are provided, `config` is merged on top of the named view.

## What's Next?

With graph view mastery, you're ready to explore advanced Foam features:

1. **[[wikilinks]]** - Understand bidirectional connections
2. **[[templates]]** - Use templates effectively to standardize your note creation
3. **[[tags]]** - Organize your notes with tags
4. **[[daily-notes]]** - Set up daily notes to establish capture routines

---

## Legacy: `foam.graph.style`

> **Deprecated.** Configure the graph via `foam.graph.views` instead (see above). Define a `"Default"` view to replace any settings you have in `foam.graph.style`.

`foam.graph.style` still works and is applied as the base layer before any view config:

```json
"foam.graph.style": {
    "background": "#202020",
    "fontSize": 12,
    "fontFamily": "Sans-Serif",
    "lineColor": "#277da1",
    "lineWidth": 0.2,
    "particleWidth": 1.0,
    "highlightedForeground": "#f9c74f",
    "node": {
        "note": "#277da1",
        "placeholder": "#545454",
        "tag": "#f9c74f"
    }
}
```

![Graph style demo](../../assets/images/graph-style.gif)

[wikilinks]: wikilinks.md 'Wikilinks'
[tags]: tags.md 'Tags'
[templates]: templates.md 'Note Templates'
[daily-notes]: daily-notes.md 'Daily Notes'
