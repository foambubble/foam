---
issue: 1205
type: feature
created: 2026-11-05
---

# Graph view preferences: display options live in the view, not settings.json

## Context

[#1205](https://github.com/foambubble/foam/issues/1205) reports that
`foam.graph.titleMaxLength` does not apply to placeholder nodes. The report is
accurate: titles are truncated on the extension side before the graph data is
sent to the webview, and placeholder titles never pass through that transform.
The maintainer's direction is not to patch the setting but to retire it: graph
display options should not be VS Code settings — they belong to the graph view
itself.

No graph-view-local configuration mechanism exists today. The graph's control
panel already holds interactive display state — type filter checkboxes,
size/force sliders, custom groups — all in memory, all lost when the panel
closes. [#1574](https://github.com/foambubble/foam/issues/1574) asks for type
filters to persist across reloads and proposes a `settings.json` key; the
maintainer's comment there asks instead for a consolidated way to expose graph
settings. This spec defines that mechanism, with title truncation as its first
entry and type filters as the documented next consumer.

Scope decision: removing the setting alone would either hard-code a truncation
length nobody can change or stop truncating every label, and a mechanism with
no implemented entry cannot be verified. So v1 removes the setting **and**
introduces the preferences mechanism with truncation as its first entry.

Removing a user-visible setting is worth a release-notes callout when this
ships (fragments are written at release time; `.changeset/` is untouched
here). No page under `docs/user/` documents `foam.graph.titleMaxLength`
today, so the docs work is describing the new behavior, not deleting the old.

## Decisions

The mechanism, at the level a reviewer of this spec should weigh in on:

1. **Where preferences persist.** Per workspace, in extension-side storage
   (`ExtensionContext.workspaceState`), as one object under one key. Filters
   and display choices depend on the vault's content, so per-workspace is the
   right scope; `settings.json` is explicitly not the direction; webview
   `setState` does not survive closing the panel.

2. **How they reach the webview.** Through the existing message protocol:
   the extension sends the whole preferences object alongside the style after
   `webviewDidLoad` (and on later external changes); the webview sends the
   whole updated object back when the user changes a preference in the
   control panel, and the extension persists it. One generic message pair for
   the object — no per-entry message types.

3. **How a new entry is added later.** One typed preferences object, owned by
   the protocol definition in `@foam/graph-view`; defaults live with the view.
   Unknown keys in stored preferences are preserved on load and save, so an
   older extension never destroys a newer one's entries. Adding an entry —
   `showNodesOfType` for #1574 is the worked example — means: add the field
   and its default, bind the existing control-panel control to it. No new
   VS Code setting, no new message types, no storage migration.

4. **Relationship to `foam.graph.views`.** Named views stay what they are:
   declarative starting points in `settings.json`. Preferences record the
   user's last interactive choices. In v1 the two cannot conflict (no view
   field controls truncation); precedence once they overlap is an open
   question below, to be settled when #1574 is specced.

5. **Truncation becomes a display concern.** Full titles cross the
   extension→webview boundary; the view truncates labels at render time,
   uniformly for every node type — which is what makes the original #1205
   symptom disappear, since placeholders are no longer special. The default
   stays at today's default (24 characters, `0` or less disables).

## Acceptance criteria

- **AC-1**: Given the extension's contributed configuration, when it is
  inspected, then `foam.graph.titleMaxLength` is not declared, and setting it
  in `settings.json` has no effect on the graph.
  _verify: unit_
- **AC-2**: Given any resource, when graph data is produced for the webview,
  then its title is sent untruncated.
  _verify: unit_
- **AC-3**: Given a node whose title is longer than the truncation length,
  when the graph renders its label, then the label is shortened with an
  ellipsis — for every node type, placeholders included; a length of `0` or
  less renders labels in full.
  _verify: unit_
- **AC-4**: Given the user changes the truncation length in the graph control
  panel, when the graph re-renders, then labels reflect the new value.
  _verify: unit_
- **AC-5**: Given a preference changed in the control panel, when the graph
  panel is closed and reopened in the same workspace, then the preference is
  restored.
  _verify: unit_
- **AC-6**: Given a changed preference, when VS Code is reloaded and the
  graph opened again, then the preference is intact.
  _verify: human_
- **AC-7**: Given stored preferences containing keys this version does not
  know, when preferences are loaded and saved again, then the unknown keys
  survive unchanged.
  _verify: unit_
- **AC-8**: Given `docs/user/features/graph-view.md`, when a user reads it,
  then it describes the truncation preference and that control-panel
  preferences persist per workspace.
  _verify: human_

## Out of scope

- Persisting type filters (#1574). It is the next consumer of this mechanism
  and the forward-compatibility benchmark, but it ships on its own branch.
- Smarter placeholder labels — middle truncation or basename-only display,
  raised in #1205's discussion. Orthogonal display refinement; can become a
  preference later without touching the mechanism.
- Migrating `foam.graph.style` (already deprecated) or `foam.graph.views`
  into this mechanism.
- Carrying over a user's customized `titleMaxLength` value from
  `settings.json`. The value is dropped; the preference's default preserves
  today's default behavior.

## Open questions

- Precedence between a named view's config and persisted preferences once
  they overlap (first real case: #1574's filters vs a view's `show`).
  Proposed: an explicit view invocation wins when the graph opens; interactive
  changes made afterwards are recorded as preferences. Nothing in v1 depends
  on the answer.
- Whether the rest of the in-memory control-panel state (sliders, forces,
  link animation) should become persisted preferences immediately. Assumed
  no: v1 persists only truncation to prove the mechanism; the rest migrates
  as each one is wanted.
