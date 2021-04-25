# Note Templates

Foam supports note templates. Templates are a way to customize the starting content for your notes (instead of always starting from an empty note).

Note templates are files located in the special `.foam/templates` directory.

## Quickstart

Create a template:

* Run the `Foam: Create New Template` command from the command palette
* OR manually create a regular `.md` file in the `.foam/templates` directory

![Create new template GIF](../assets/images/create-new-template.gif)

_Theme: Ayu Light_

To create a note from a template:

* Run the `Foam: Create New Note From Template` command and follow the instructions. Don't worry if you've not created a template yet! You'll be prompted to create a new template if none exist.
* OR run the `Foam: Create New Note` command, which uses the special default template (`.foam/templates/new-note.md`, if it exists)

![Create new note from template GIF](../assets/images/create-new-note-from-template.gif)

_Theme: Ayu Light_

## Default template

The `.foam/templates/new-note.md` template is special in that it is the template that will be used by the `Foam: Create New Note` command.
Customize this template to contain content that you want included every time you create a note.

## Variables

Templates can use all the variables available in [VS Code Snippets](https://code.visualstudio.com/docs/editor/userdefinedsnippets#_variables).

In addition, you can also use variables provided by Foam:

| Name         | Description                                                                         |
| ------------ | ----------------------------------------------------------------------------------- |
| `FOAM_TITLE` | The title of the note. If used, Foam will prompt you to enter a title for the note. |

**Note:** neither the defaulting feature (eg. `${variable:default}`) nor the format feature (eg. `${variable/(.*)/${1:/upcase}/}`) (available to other variables) are available for these Foam-provided variables.
