---
'@foam/core': patch
'foam-vscode': patch
'@foam/cli': patch
---

Foam query `path` and `folder` fields are now workspace-relative, as documented,
instead of exposing the absolute filesystem path. Previously a workspace at
`C:\Docs` (or `/home/me/notes`) rendered `/C:/Docs/test/file.md` instead of
`/test/file.md`. The `path:` filter, the `"/regex/"` shorthand, and `jexl`'s
`resource.path` now match against the same workspace-relative path, so anchored
patterns like `path: "^/projects/"` behave identically on every OS. (#1698)
