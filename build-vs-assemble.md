# Build vs Assemble

The Foam prototype is built by assembling third-party extensions, which seems like a good strategy because
- It supports picking and mixing of tools and workflows
- Less code to write an maintain

But there's also a bunch of roadmap items that are hard to implement this way, as the third party plugins don't do exactly what we want them to do (e.g. Markdown All In One is not compatible with [Referencing notes by title workflow](referencing_notes_by_title.md))
