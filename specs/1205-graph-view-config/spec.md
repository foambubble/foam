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
settings. This spec defines that mechanism. The persisted object is the
control panel's whole interactive state, so #1574's reset-on-reload complaint
is addressed here rather than in a follow-up; title truncation joins that
state as a new entry.

Scope decision: removing the setting alone would either hard-code a truncation
length nobody can change or stop truncating every label, and a mechanism with
no implemented entry cannot be verified. So v1 removes the setting **and**
introduces the preferences mechanism, persisting the control panel's whole
interactive display state — type filters, sliders, forces, link animation,
local style tweaks, custom groups — rather than truncation alone: the work
is the same, and since this is internal state today, the worst a future
shape change can cause is the loss of saved view settings. Transient
interaction state (node selection, hover, an in-progress group draft) is
not part of it.

Removing a user-visible setting is worth a release-notes callout when this
ships (fragments are written at release time; `.changeset/` is untouched
here). No page under `docs/user/` documents `foam.graph.titleMaxLength`
today, so the docs work is describing the new behavior, not deleting the old.

## Decisions

The mechanism, at the level a reviewer of this spec should weigh in on:

1. **Where preferences persist.** Per workspace, in extension-side storage
   (`ExtensionContext.workspaceState`), as one object under one key. Filters
   and display choices depend on the vault's content, so per-workspace is
   the right scope, and webview `setState` does not survive closing the
   panel. `settings.json` is the wrong home because these values are the
   write target of UI gestures: persisting them through configuration would
   edit the user's settings file on every toggle (churn in a possibly
   committed `.vscode/settings.json`), let transient state clobber
   hand-written config, and make every new entry a contributed setting —
   public API with docs and a deprecation path, which is exactly the
   coupling this work removes. Declared, shareable, syncable configuration
   remains `foam.graph.views`; preferences are state, like VS Code's own
   panel layout.

2. **How they reach the webview.** Through the existing message protocol:
   the extension sends the whole preferences object alongside the style after
   `webviewDidLoad` (and on later external changes); the webview sends the
   whole updated object back when the user changes a preference in the
   control panel, and the extension persists it. One generic message pair for
   the object — no per-entry message types.

3. **How a new entry is added later.** One typed preferences object, owned by
   the protocol definition in `@foam/graph-view`; defaults live with the view.
   Unknown keys in stored preferences are preserved on load and save, so an
   older extension never destroys a newer one's entries. Adding an entry
   means: add the field and its default, bind the control-panel control to
   it. No new VS Code setting, no new message types, no storage migration —
   and none owed: if the stored shape ever changes incompatibly, the
   acceptable worst case is losing saved view state.

4. **Relationship to `foam.graph.*` settings.** Named views stay what they
   are: declarative, shareable starting points in `settings.json` —
   hand-written, never auto-written. Preferences record the user's last
   interactive choices. The webview keeps receiving a single resolved
   view-config object; what that object is merged from can grow to span the
   various `foam.graph.*` settings as well as the preferences. Whether those
   settings stay individual or consolidate into one blob needs no answer
   now: the user-facing settings surface is not expected to mirror the
   webview's internal config shape, so a translation between the two is
   assumed either way (one already exists in kind for named views).
   Settings passed to the `show-graph` command — a named view or an
   inline config — always prevail over the defaults when the graph opens.
   Interactive changes made while a named view is open are saved for that
   view alone: views are identified by name, and preferences are recorded
   under that name; anything a view's preferences don't cover falls back to
   the default view settings. An invocation without a view name belongs to
   the default bucket (which is where today's nameless open already lands,
   via the `Default` view fallback). This shapes the stored object from v1 —
   preferences keyed by view name — even while truncation is the only entry.

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
  panel is closed and reopened in the same workspace with the same view,
  then the preference is restored; a different named view is unaffected.
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
- **AC-9**: Given node type filters changed in the control panel, when the
  graph is reopened with the same view, then the filters are restored (the
  #1574 scenario).
  _verify: unit_

## Out of scope

- Smarter placeholder labels — middle truncation or basename-only display,
  raised in #1205's discussion. Orthogonal display refinement; can become a
  preference later without touching the mechanism.
- Migrating `foam.graph.style` (already deprecated) or `foam.graph.views`
  into this mechanism.
- Carrying over a user's customized `titleMaxLength` value from
  `settings.json`. The value is dropped; the preference's default preserves
  today's default behavior.
- An explicit "save current view as a named view" control-panel action — a
  deliberate settings write that would bridge preferences back into
  `foam.graph.views`, giving sync and shareability on demand. A possible
  later complement to ambient persistence; not needed for v1.
