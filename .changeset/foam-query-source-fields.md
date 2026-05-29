---
'@foam/core': minor
'foam-vscode': minor
---

`foam-query` blocks can now select note content as a field: `body` (full text with the H1 title kept), `content` (without the title), and `section[Label]` (the content of a named section, heading stripped). These fields are rendered as markdown — wikilinks, embeds, and formatting inside them stay live in the preview. Section labels are matched case-sensitively, matching the embed (`![[note#Section]]`) convention. Labels with spaces work directly in block-sequence `select:` lists; the inline `select: [...]` form requires quoting, e.g. `'section[My Label]'`.

Wikilinks and markdown links inside source-derived cells are rewritten to absolute workspace paths before rendering, so a `[[link]]` originally written in another note still resolves correctly from a query cell (including any `#Section` / `#^block` fragment). Self-referencing queries and embed↔query cycles are caught by a shared cycle-detection stack and render as a warning instead of overflowing the call stack.

API additions in `@foam/core`: `executeQuery` and `renderDqlQuery` / `renderJsQuery` accept an optional `readSource: (uri) => string` callback that returns a resource's raw markdown on demand. `renderResults` / `renderList` / `renderTable` accept an optional `renderMarkdown: (markdown, sourceUri?) => string` callback and an optional `context: RenderContext` for sharing the cycle stack between renderers (e.g. embed and query). `createRenderContext()` builds one; `requiresSource(field)` is exported for hosts that need to gate on source-derived fields. `ResourceView` now structurally carries `uri: URI` on every row. Without `readSource`/`renderMarkdown`, the new fields resolve to `undefined` / escaped raw text — existing callers are unaffected. Resolves #1654.
