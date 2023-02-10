# Resource Filters

Resource filters can be passed to some Foam commands to limit their scope.

A filter supports the following parameters:

- `tag`: include a resource if it has the given tag (e.g. `{"tag": "#research"}`)
- `type`: include a resource if it is of the given type (e.g. `{"type": "daily-note"}`)
- `path`: include a resource if its path matches the given regex (e.g. `{"path": "/projects/*"}`). **Note that this parameter supports regex and not globs.**
- `expression`: include a resource if it makes the given expression `true`, where `resource` represents the resource being evaluated (e.g. `{"expression": "resource.type ==='weekly-note'"}`)
- `title`: include a resource if the title matches the given regex (e.g. `{"title": "Team meeting:*"}`)

A filter also supports some logical operators:

- `and`: include a resource if it matches all the sub-parameters (e.g `{"and": [{"tag": "#research"}, {"title": "Paper *"}]}`)
- `or`: include a resource if it matches any of the sub-parameters (e.g `{"or": [{"tag": "#research"}, {"title": "Paper *"}]}`)
- `not`: invert the result of the nested filter (e.g. `{"not": {"type": "daily-note"}}`)

Here is an example of a complex filter, for example to show the Foam graph only of a subset of the workspace:

```
{
  "key": "alt+f",
  "command": "foam-vscode.show-graph",
  "args": {
    "filter": {
      "and": [
        {
          "or": [
            { "type": 'daily-note' },
            { "type": 'weekly-note' },
            { "path": '/projects/*' },
          ],
          "not": {
            { "tag": '#b' },
          },
        },
      ],
    }
  }
}
```
