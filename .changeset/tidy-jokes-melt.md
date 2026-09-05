---
'foam-vscode': patch
---

The "Create daily note template" button now writes the template to the folder
configured in `foam.templates.folder`, instead of always to `.foam/templates`.

With a custom templates folder the scaffolded file landed where Foam never
looks for it, so the "No daily note template found" warning came back every
time and the file appeared somewhere the user had not configured.
