# Note Templates

Foam supports note templates.

Note templates live in `.foam/templates`. Run the `Foam: Create New Template` command from the command palette or create a regular `.md` file there to add a template.

![Create new template GIF](../assets/images/create-new-template.gif)

_Theme: Ayu Light_

To create a note from a template, execute the `Foam: Create New Note From Template` command and follow the instructions. Don't worry if you've not created a template yet! You'll be prompted to create a new template if none exist.

![Create new note from template GIF](../assets/images/create-new-note-from-template.gif)

_Theme: Ayu Light_

### Variables

Templates can use all the variables available in [VS Code Snippets](https://code.visualstudio.com/docs/editor/userdefinedsnippets#_variables).

In addition, you can also use variables provided by Foam:

| Name         | Description                                                                         |
| ------------ | ----------------------------------------------------------------------------------- |
| `FOAM_TITLE` | The title of the note. If used, Foam will prompt you to enter a title for the note. |

**Note:** neither the defaulting feature (eg. `${variable:default}`) nor the format feature (eg. `${variable/(.*)/${1:/upcase}/}`) (available to other variables) are available for these Foam-provided variables.
