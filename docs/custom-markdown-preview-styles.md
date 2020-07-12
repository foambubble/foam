# Custom Markdown Preview Styles

Visual Studio Code allows you to use your own CSS in the Markdown preview tab.

## Instructions

Custom CSS for the Markdown preview can be implemented by using the `"markdown.styles": []` setting in `settings.json`. The stylesheets can either be https URLs or relative paths to local files in the current workspace.

For example, to load a stylesheet called `Style.css`, we can update `settings.json` with the following line:

```
{
  "markdown.styles": ["Style.css"]
}
```
