# Proposal: Link Definition and Disambiguation

## Current status

- We generate link ref defs from wiki-links inline
- Wiki links are expected to be the full source of truth, but we don't have enough information to conclusively disambiguate between files 
  - that have the same file name (in different directories)
  - that have the same title (if autocompletion is by title)

## Solution

- Don't wipe out link ref defs. Only add/remove as needed. This can be our metadata for disambiguation.

Let's say we have two documents in the workspace with the same title "Some Title"

- We would have autocompletion base on title of the document
  - This generates a link (typically a title, but could also have e.g. `:2` to disambiguate multiple links in the same file)
  - The label doesn't matter, it could be used as a display label. We'll just auto-generate something sensible. Could even be a user setting.
- They would look like this:
  ```
  [[Some File]]
  [[Some File:2]]
  ```
- The link ref definitions become equivalent to import statements in a programming language, telling us where we are importing and what:
  `[Some File]: some-file.md: "Some file in root directory"`
  `[Some File:2]: subdirectory/some-file.md: "Some file in a subdirectory"`
- Here the title component of the link ref definition becomes optional since display name can be controlled by the label inside link.   
- Note that we are adding .md here by default, but can omit that based on user preference as per @jojanaho's proposal
  - Fixes GitHub UI rendering
  - Breaks GitHub Pages links, but we'll override links in JavaScript as we do titles right now
  - Going forward, Gatsby or other build tool can consume these directly
- This will also help us with anchor links, because we don't need to put them inline in the label anymore:
  - `[Some File With Anchor Section]: some-file.md#anchor`
- This would also allow us to be more permissive of file names
  - Markdown labels, the target needs to be a valid URI so we may needs to URI encode
  - `[Some File With Anchor Section]: Some%20File%20With%20Anchor%20Section.md`
- For migrating into this structure, we'll need to do a bit of guesswork and/or manual editing, but we can build tooling to make this easier (e.g. in `foam-cli janitor/migrate`) and ensure lint consistency with `foam-cli lint`
  - In VS Code we can surface any issues in the Problems/Diagnostic pane
  - We could also show syntax errors (red squigglies) inline, with a `Quick Fix...` menu
- This all means that we will have to severely change Markdown Notes or replace it
- Take into account @digiguru's work on supporting accents etc.

## Plan

- CLI team is finishing first iteration of foam-cli janitor/migrate/lint
  - This will not affect their work, and we'll ensure their work can be used in the new structure
  - Link ref def parsing is already on their branch, let's try to land that ASAP
- Fix the .md generation @riccardo
  - Change the way the links are generated in vs code
  - Add a bit of javascript
- Start treating metadata as source of truth
  - Definitions are already on https://github.com/foambubble/foam/pull/112/files
- For autocompletion, @jevakallio has started a spike, aim to get something prototyped by Friday
