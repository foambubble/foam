---
'foam-vscode': patch
---

Attachment and image links now honor `workbench.editorAssociations` at every settings scope (including user-level and profile-propagated settings) ([#1675](https://github.com/foambubble/foam/issues/1675)). Wikilinks and reference-style links open through the `vscode.open` command — the same mechanism used by the built-in Markdown extension — while direct markdown links defer entirely to the built-in Markdown extension instead of shadowing its links.
