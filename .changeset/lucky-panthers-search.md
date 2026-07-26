---
'foam-vscode': patch
---

Attachment and image links now open through the `vscode.open` command, so `workbench.editorAssociations` is honored at every settings scope (including user-level and profile-propagated settings), matching the behavior of the built-in Markdown extension ([#1675](https://github.com/foambubble/foam/issues/1675)).
