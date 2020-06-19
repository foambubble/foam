# Roam comparison

Over time, Roam may build features Foam won't or can't support (APIs, real time collaboration, etc.), but at the time of writing (June 2020) here are some things Foam could implement but hasn't yet.

## Missing Roam features

### Big features

- Unlinked references and back links from other pages (this is a big one)
  - Could be implemented as a terminal view of sort, run a language server in the background and show them in the "output" tab like you show test results in jest
- Automatically create a new page when referencing an unknown file
  - This support could be added to MD All in one
- Granular [publishing](publishing_pages.md) permissions
  - Publish per page
  - Invite-only bubbles
- Knowledge graph visualiser
  - Easy to build once document graph is assembled

### Minor UX annoyances

- Can't just call it `Some page`, must be `some_page.md`
- Should be easier to reference for a file in workspace without `[]()`, for example just [filename] (no extensions needed, workspace can treat extensionless files as Foam files)
- Renaming/moving documents requires to rename all references
  - Could probably be automated

