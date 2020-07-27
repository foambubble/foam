# Markdown Notes Autocomplete

The default behaviour of Markdown Notes Autocomplete is to suffix `.md` to the end of suggestion, such as in the below screenshot:

![Autocomplete from Markdown Notes with file extension](./assets/images/md-notes-autocomplete-with-extension.png)

To change this behaviour, add the below to your `.vscode/settings.json` file:

```json
"vscodeMarkdownNotes.noteCompletionConvention": "noExtension"
```

Now your autocomplete will look like the below screenshot:

![Autocomplete from Markdown Notes without file extension](./assets/images/md-notes-autocomplete-no-extension.png)