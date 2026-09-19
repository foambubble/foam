---
'@foam/core': patch
'foam-vscode': patch
'@foam/cli': patch
---

Fixes to note creation and folder renames, found by re-enabling the foam-vscode
integration suite:

- `create-note` no longer fails with `path.startsWith is not a function` when
  given a URI, and the workspace no longer throws `reference.split is not a
  function` when looked up by one. Both narrowed on `instanceof URI`, which does
  not hold for a URI that crosses into the extension bundle's inlined copy of
  `@foam/core`
- Renaming a folder keeps its notes in the index without a gap: they are re-keyed
  under the new path as the rename completes, instead of being removed and
  re-read asynchronously, which briefly left them indexed under neither path
- Renaming the same folder twice in a row now updates the wikilinks both times.
  The files rewritten by the first rename are re-indexed, and the work is
  registered as a rename participant so it completes before the rename lands
  rather than racing whatever comes next
- Deleting a path that is already gone no longer brings down the extension host
  with an unhandled `EntryNotFound` rejection
