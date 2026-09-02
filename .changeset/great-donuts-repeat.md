---
'@foam/core': patch
'foam-vscode': patch
'@foam/cli': patch
---

Fixed notes disappearing from the workspace index when their folder is moved or
renamed in the Explorer ([#1696](https://github.com/foambubble/foam/issues/1696)).
The notes were dropped from the Notes Explorer, graph, backlinks, `foam-query`
and wikilink resolution, under both the old and the new path, and only a window
reload brought them back. Because the entries were gone, moving the same folder
a second time also silently stopped updating any links pointing into it.

A directory rename now migrates the index itself instead of relying on file
watcher events that a directory-granularity rename may never produce: the
affected notes are re-indexed under their new paths as part of the rename, on
every platform. Index migration also no longer depends on the
`foam.links.sync.enable` setting.

Include/exclude matching now evaluates the globs directly rather than looking
paths up in a snapshot of the workspace file listing, which could go stale and
never recover. Matching is case-insensitive and covers dot-directories, mirroring
how `workspace.findFiles` behaves today, and the VS Code extension and the CLI
now share one matcher implementation.
