# Daily notes

Automatically create a Daily Note by executing the "Foam: Open Daily Note" command. If a Daily Note for today's date already exists, the command opens the existing note.

![Daily note feature in action](assets/images/daily-note.gif)

## Keyboard shortcut

The default keyboard shortcut for "Open Daily Note" is `alt`+`d`. This can be overridden using the [VS Code Keybindings editor](https://code.visualstudio.com/docs/getstarted/keybindings).

## Configuration

By default, Daily Notes will be created in a file called `yyyy-mm-dd.md` in the workspace root, with a heading `yyyy-mm-dd`. 

These settings can be overridden in your workspace or global `.vscode/settings.json` file, using the [**dateformat** date masking syntax](https://github.com/felixge/node-dateformat#mask-options):

```json
  "foam.openDailyNote.directory": "journal",
  "foam.openDailyNote.filenameFormat": "'daily-note'-yyyy-mm-dd",
  "foam.openDailyNote.fileExtension": "mdx",
  "foam.openDailyNote.titleFormat": "'Journal Entry, ' dddd, mmmm d",
```

The above configuration would create a file `journal/note-2020-07-25.mdx`, with the heading `Journal Entry, Sunday, July 25`.

## Daily Note Templates

In the future, Foam may provide a functionality for specifying a template for new Daily Notes and other types of documents.

In the meantime, you can use [VS Code Snippets](https://code.visualstudio.com/docs/editor/userdefinedsnippets) for defining your own Daily Note template.

## Roam-style Automatic Daily Notes

In the future, Foam may provide an option for automatically opening your Daily Note when you open your Foam workspace.

If you want this behaviour now, you can use the excellent [Auto Run Command](https://marketplace.visualstudio.com/items?itemName=gabrielgrinberg.auto-run-command#review-details) extension to run the "Open Daily Note" command upon entering a Foam workspace by specifying the following configuration in your `.vscode/settings.json`:

```json
  "auto-run-command.rules": [
    {
      "condition": "hasFile: .vscode/foam.json",
      "command": "foam-vscode.open-daily-note",
      "message": "Have a nice day!"
    }
  ],
```
