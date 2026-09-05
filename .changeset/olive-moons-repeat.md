---
'@foam/core': patch
'foam-vscode': patch
'@foam/cli': patch
---

`isWithinPath` now compares Windows drive paths case-insensitively, matching
what `FoamWorkspace` already did for its own root matching. The two helpers
answer the same question — "is this path inside that one?" — but only the
workspace one allowed for a drive letter whose case differs between VS Code
and Node, which is a case the codebase already knew it could not trust.

The exact comparison reached four places: the check that a new note is inside
the workspace, `getRootUriFor` (which picks the root for `.foam/trash` and for
workspace-relative paths), the MCP server's path serialisation, and the export
asset filter. On Windows a drive-case mismatch could make each of them decide
a path was outside the workspace when it was not.
