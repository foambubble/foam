---
'@foam/core': patch
'foam-vscode': patch
'@foam/cli': patch
---

Note creation is now defined once in `@foam/core` and shared by the VS Code
commands (create note, daily notes), the CLI and the MCP server. The check
that a new note stays inside the workspace — including on every retry path
proposed while handling an existing file, and after a template has set its
own `filepath` — now lives in a single place.

Behavior changes that come with it:

- The VS Code create-note command resolves template content once. Passing
  `FOAM_SELECTED_TEXT` as a variable no longer appends the selected text
  twice.
- Foam variables in the content returned by a JavaScript template are
  resolved in the CLI and MCP server as well, not only in VS Code.
- `foam note create --dir <dir>` (and the MCP `create_resource` `dir`
  argument) is honored when the `new-note.md` template sets no `filepath`;
  it used to be ignored in that case.
- A daily-note directory configured as an absolute path outside the
  workspace is used as such when a `daily-note.md` template sets no
  `filepath`, matching the behavior without a template. It used to be
  re-rooted inside the workspace.
