# Custom Note Macros

This #recipe allows you to create custom note macros.

## Installation

**This extension is not included in the template**

To install search note-macros in vscode or head to [note-macros - Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=NeelyInnovations.note-macros)

## Instructions

### Run macro From command pallette

Simply use `Ctrl+P` or `Alt+P` depend on your os, and type `Note Macros: Run A Macro` then chose the macro you want to execute.

### Create Custom Note Macros

Create your own custom macros by adding them to your `settings.json` (Code|File > Preferences > User Settings). A full example can be found at [settings.json](https://github.com/kneely/note-macros/blob/master/settings.json)

For example:

This macro creates a Weekly note in the Weekly note Directory.

```json
{
  "note-macros": {
    "Weekly": [
      {
        "type": "note",
        "directory": "Weekly",
        "extension": ".md",
        "name": "weekly-note",
        "date": "yyyy-W"
      }
    ]
  }
}
```

For an explanation of the fields please go to [note-macros - Explanation of Fields](https://github.com/kneely/note-macros#explanation-of-fields)

### Add Keybindings to Run your Macros

in `keybindings.json` (Code|File > Preferences > Keyboard Shortcuts) add bindings to your macros:

```json
{
  "key": "ctrl+cmd+/",
  "command": "note-macros.Weekly"
}
```

## Issues and Feedback

If you have any issues or questions please look at the [README.md](https://github.com/kneely/note-macros#note-macros) on the [note-macros](https://github.com/kneely/note-macros) GitHub.

If you run into any issues that are not fixed by referring to the README or feature requests please open an [issue](https://github.com/kneely/note-macros/issues).
