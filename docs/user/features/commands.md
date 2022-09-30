# Foam Commands

Foam has various commands that you can explore by calling the command palette and typing "Foam".

In particular, some commands can be very customizible and can help with custom workflows and use cases.

## foam-vscode.create-note command

This command creates a note.
Although it works fine on its own, it can be customized to achieve various use cases.
Here are the settings available for the command:
-  notePath: The path of the note to create. If relative it will be resolved against the workspace root.
- templatePath: The path of the template to use. If relative it will be resolved against the workspace root.
- text: The text to use for the note. If also a template is provided, the template has precedence
- variables: Variables to use in the text or template (e.g. `FOAM_TITLE`)
- date: The date used to resolve the FOAM_DATE_* variables. in `YYYY-MM-DD` format
- onFileExists?: 'overwrite' | 'open' | 'ask' | 'cancel': What to do in case the target file already exists

To customize a command and associate a key binding to it, open the key binding settings and add the appropriate configuration, here are some examples:

- Create a note called `test note.md` with some text. If the note already exists, ask for a new name
```
{
  "key": "alt+f",
  "command": "foam-vscode.create-note",
  "args": {
    "text": "test note ${FOAM_DATE_YEAR}",
    "notePath": "test note.md",
    "onFileExists": "ask"
  }
}
```

- Create a note following the `weekly-note.md` template. If the note already exists, open it
```
{
  "key": "alt+g",
  "command": "foam-vscode.create-note",
  "args": {
    "templatePath": ".foam/templates/weekly-note.md",
    "onFileExists": "open"
  }
}
```

