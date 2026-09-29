# Resource Filters

Resource filters can be passed to some Foam commands to limit their scope.

A filter supports the following parameters:

- `tag`: include a resource if it has the given tag (e.g. `{"tag": "#research"}`)
- `type`: include a resource if it is of the given type. Foam assigns `note` to every markdown file, and `image` or `attachment` to other files (e.g. `{"type": "attachment"}`). This is _not_ the `type` you write in a note's frontmatter — to filter on that, use `jexl`
- `path`: include a resource if its path matches the given regex (e.g. `{"path": "/projects/*"}`). **Note that this parameter supports regex and not globs.**
- `jexl`: include a resource if the given [Jexl](https://github.com/TomFrost/Jexl) expression is truthy, where `resource` represents the resource being evaluated (e.g. `{"jexl": "resource.properties.type == 'weekly-note'"}` to match notes by their frontmatter `type`)
- `title`: include a resource if the title matches the given regex (e.g. `{"title": "Team meeting:*"}`)

A filter also supports some logical operators:

- `and`: include a resource if it matches all the sub-parameters (e.g `{"and": [{"tag": "#research"}, {"title": "Paper *"}]}`)
- `or`: include a resource if it matches any of the sub-parameters (e.g `{"or": [{"tag": "#research"}, {"title": "Paper *"}]}`)
- `not`: invert the result of the nested filter (e.g. `{"not": {"type": "attachment"}}`)

Here is an example of a complex filter, to open a resource from a subset of the workspace:

```json
{
  "key": "alt+f",
  "command": "foam-vscode.open-resource",
  "args": {
    "filter": {
      "and": [
        {
          "or": [
            { "jexl": "resource.properties.type == 'daily-note'" },
            { "jexl": "resource.properties.type == 'weekly-note'" },
            { "path": "/projects/*" }
          ]
        },
        { "not": { "tag": "#b" } }
      ]
    }
  }
}
```
