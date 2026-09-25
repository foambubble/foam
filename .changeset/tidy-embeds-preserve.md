---
"foam-vscode": patch
"@foam/cli": patch
---

Omit leading YAML metadata from whole-note embeds. Content-only embeds now preserve the first body line of titleless notes and all subsequent sections, and remove complete ATX or Setext titles without shifting section or block references.
