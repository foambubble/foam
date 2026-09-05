---
'foam-vscode': patch
---

Foam no longer treats VS Code's `files.watcherExclude` as a reason to skip files
when loading the workspace. That setting means "don't spend CPU watching this",
not "this is not part of my workspace" — and VS Code already applies it to
recursive watchers itself, so honouring it here bought no CPU saving while
silently dropping those notes from the index entirely: no backlinks, no
placeholders, and no way to get them back short of changing the setting. To keep
a folder out of Foam, use `foam.files.exclude`, which is unchanged. This also
brings the extension back in line with `@foam/cli`, which never applied
`files.watcherExclude`.
