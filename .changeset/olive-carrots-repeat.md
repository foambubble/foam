---
'foam-vscode': patch
---

Fixed newly added images not being picked up until the window was reloaded
([#1697](https://github.com/foambubble/foam/issues/1697)). Since 0.44.3 the file
watcher was scoped to note and attachment extensions, but it read the extension
list straight from `foam.files.attachmentExtensions` — whose default carries no
image types, because images are treated as attachments unconditionally. Pasting
an image therefore created a file Foam never saw: no hover preview, no embed in
the Markdown preview, and no removal from the graph when the image was deleted
or renamed. The watcher now derives its extensions from the attachment provider,
so the two can no longer disagree.
