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

## Foam elements

### Foam note & placeholder links

It is possible to custom style the links to a note or placeholder. The links are an `<a>` tag. For notes use the class `foam-note-link`, for placeholders use `foam-placeholder-link`.

### Cyclic inclusion warnings

Foams offers the functionality to include other notes in your note. This will be displayed in the preview tab. Foam recognises a cyclic inclusion of notes and will display a warning when detected. The following html is used and can be custom styled using the class `foam-cyclic-link-warning`.

```html
<div class="foam-cyclic-link-warning">
  Cyclic link detected for wikilink: ${wikilink}
</div>
```
