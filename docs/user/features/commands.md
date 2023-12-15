# Foam Commands

Foam has various commands that you can explore by calling the command palette and typing "Foam".

In particular, some commands can be very customizable and can help with custom workflows and use cases.

## foam-vscode.create-note command

This command creates a note.
Although it works fine on its own, it can be customized to achieve various use cases.
Here are the settings available for the command:

- `notePath`: The path of the note to create. If relative it will be resolved against the workspace root.
- `templatePath`: The path of the template to use. If relative it will be resolved against the workspace root.
- `title`: The title of the note (that is, the `FOAM_TITLE` variable)
- `text`: The text to use for the note. If also a template is provided, the template has precedence
- `variables`: Variables to use in the text or template
- `date`: The date used to resolve the FOAM*DATE*\* variables. in `YYYY-MM-DD` format
- `onFileExists?: 'overwrite' | 'open' | 'ask' | 'cancel'`: What to do in case the target file already exists

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

## foam-vscode.open-resource command

This command opens a resource.

Normally it receives a `URI`, which identifies the resource to open.

It is also possible to pass in a filter, which will be run against the workspace resources to find one or more matches.

- If there is one match, it will be opened
- If there is more than one match, a quick pick will show up allowing the user to select the desired resource

Examples:

```
{
  "key": "alt+f",
  "command": "foam-vscode.open-resource",
  "args": {
    "filter": {
      "title": "Weekly Note*"
    }
  }
}
```
