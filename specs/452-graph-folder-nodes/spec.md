---
issue: 452
type: feature
created: 2026-11-25
---

# Graph view: folders as nodes

## Context

[#452](https://github.com/foambubble/foam/issues/452) asks the graph view to
show the workspace's directory structure. Today a note with no links floats
alone in the graph, however deep it sits in a folder tree — the thread's
example is `knowledge/dev/python/profilers.md`. Tags already tie notes to a
shared node; folders, drawn the same way, would tie every note to where it
lives.

The thread also discussed drawing folders as containers (G6 combos) and
generating index notes per folder. Both are out of scope: this spec adds folder
nodes and links, nothing that reshapes the layout or writes files.

## Decisions

1. **Folders are a built-in node type, `folder`, modelled on `tag`.** A folder
   links to each of its subfolders and to each file directly inside it, the
   way a tag links to its child tags and to its notes. Like tags and
   placeholders, folders keep their own colour when the graph is coloured by
   directory.
2. **Hidden by default.** The control panel gets a "Show folders" checkbox
   among the built-in types. A view turns folders on with
   `show.folder.enabled: true` and colours them with `show.folder.color`; a
   `show.folder` entry without `enabled: true` leaves them hidden. The
   checkbox is remembered per view by the existing view-state mechanism
   (#1768); nothing new is persisted.
3. **Folders are relative to their workspace folder.** The workspace folder
   itself gets no node. In a multi-root workspace, each root's folders are
   separate nodes, even where two roots have a folder of the same name.
4. **Only folders holding a file in the graph get a node** — a note,
   attachment or image, directly or in a subfolder. Empty folders and folders
   holding only excluded files never appear. Placeholders have no folder.
5. **Drawn as fixed-size squares, labelled with the folder name.** The size
   does not grow with the number of children. Squares are a new node shape.
6. **VS Code graph view only.** The output of `foam graph` (CLI) and the
   exported site's graph JSON do not change.
7. **Folder links look like every other link**, as tag links do today.
8. **A folder follows what it holds.** When every file under a folder is
   hidden by other filters (`assets/` holding only images, with images
   hidden), the folder is hidden too rather than left floating.
9. **Clicking a folder node opens nothing.** It highlights the node and its
   neighbours, as clicking a tag does.

## Acceptance criteria

- **AC-1**: Given `projects/alpha/kickoff.md`, when folders are shown, then
  there are folder nodes labelled `projects` and `alpha`, with links
  `projects` → `alpha` and `alpha` → `kickoff.md`.
  _verify: unit_
- **AC-2**: Given a note at the top of a workspace folder, and a folder that
  holds no file in the graph (it is empty, or holds only excluded files), when
  folders are shown, then the note has no folder link, and neither the
  workspace folder nor the empty folder has a node.
  _verify: unit_
- **AC-3**: Given an attachment and an image in `assets/`, and a link to a
  missing note, when folders are shown, then the attachment and the image link
  to `assets`, and the placeholder has no folder link.
  _verify: unit_
- **AC-4**: Given a multi-root workspace where both roots contain `notes/`,
  when folders are shown, then there are two `notes` nodes, each linked only
  to its own root's files.
  _verify: unit_
- **AC-5**: Given a nested tag `projects/alpha` and a folder `projects/alpha`,
  when tags and folders are shown, then the tag and the folder are separate
  nodes.
  _verify: unit_
- **AC-6**: Given no `show.folder` in the view config, when the graph opens,
  then no folder nodes are drawn and the control panel shows an unchecked
  "Show folders". Checking it shows them, and the choice is restored when that
  view is reopened.
  _verify: unit_
- **AC-7**: Given a view with
  `"show": { "folder": { "enabled": true, "color": "#888888" } }`, when it
  opens, then folder nodes are shown in that colour.
  _verify: unit_
- **AC-8**: Given a folder holding 1 file and a folder holding 200 files, when
  they are drawn, then both are squares of the same size.
  _verify: unit_
- **AC-9**: Given the same workspace, when `foam graph` runs or the site graph
  is exported, then the output has no folder nodes and is the same as before.
  _verify: unit_
- **AC-10**: Given `assets/` holding only images, when folders are shown and
  images are hidden, then `assets` is not drawn; showing images brings it
  back.
  _verify: unit_

## Out of scope

- Folders as containers, hulls or clustering forces.
- Styling links by kind.
- Folder nodes in the CLI or the exported site.
- Generated index or table-of-contents notes.
- Collapsing folders.
- Depth limits.
- Opening, revealing or otherwise acting on a folder from the graph.

## Open questions

- `show.image` and `show.attachment` entries without `enabled` turn those
  types on today, although both are hidden by default. Folders don't follow
  that (Decision 2). Making the other hidden-by-default types match is a
  change to existing views, so it is left out here.
