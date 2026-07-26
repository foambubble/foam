---
'foam-vscode': patch
---

Attachment and image links now honor `workbench.editorAssociations` at every settings scope (including user-level and profile-propagated settings) ([#1675](https://github.com/foambubble/foam/issues/1675)). Wikilinks and reference-style links open through the `vscode.open` command — the same mechanism used by the built-in Markdown extension — while direct markdown links defer entirely to the built-in Markdown extension instead of shadowing its links. Clickable link ranges now match VS Code's styling of markdown links: wikilinks no longer include the surrounding brackets, full reference links (`[text][ref]`) cover only the reference label, and collapsed/shortcut reference links cover the text.
