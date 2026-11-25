---
issue: 1787
type: feature
created: 2026-11-19
---

# Hide the graph's controls panel

## Context

[#1787](https://github.com/foambubble/foam/issues/1787) reports that the
graph's controls panel — Groups, Appearance, Forces, Selection, Reset view —
is always on screen, fixed in the top-right corner at 220 px wide, overlaying
the graph. On a narrow editor pane that is a large share of the view. The
reporter has their colours and groups set in `foam.graph.views` already, so
day to day they do not need the panel at all; collapsing every section still
leaves the header and the Reset view footer, and patching the installed
extension's bundle is undone by the next update.

The issue asks for a `foam.graph.showControls` setting, a per-view key in
`foam.graph.views`, or a toggle in the graph itself. The toggle is the one
this spec takes. Whether the panel is on screen is an interactive display
choice, and [specs/1205-graph-view-config](../1205-graph-view-config/spec.md)
settled where those live: not in `settings.json`, but in the view's own state,
persisted per view name by the extension. So hiding the panel is a gesture in
the graph that sticks — hide it once in the `Default` view and it stays hidden
across reopens and reloads, while another named view keeps its own answer.

`showControls` already exists as a property on `<foam-graph>`, defaulting to
false and set to true by the VS Code webview. That stays what it is: a host
saying whether this host offers controls at all. The user's show/hide lives
beside it, and only matters where the host offers them.

The graph-view user doc describes the panel; it gains a sentence on hiding it.

## Acceptance criteria

- **AC-1**: Given the graph with its controls panel shown, when the user
  activates the hide control, then the panel is no longer drawn and the only
  thing overlaying the graph is a control to bring it back.
  _verify: unit_
- **AC-2**: Given the panel hidden, when the user activates the show control,
  then the panel is drawn again with the same sections open and the same
  values as before it was hidden.
  _verify: unit_
- **AC-3**: Given the user hid the panel, when the graph is closed and
  reopened in the same workspace with the same view, then the panel is still
  hidden; a different named view is unaffected.
  _verify: unit_
- **AC-4**: Given a view whose saved state has the panel hidden, when the user
  presses Reset view, then that view shows its panel again, like a view that
  was never changed.
  _verify: unit_
- **AC-5**: Given a host that does not offer controls (`showControls` false, as
  every host but the VS Code webview is today), when the graph is drawn, then
  neither the panel nor any show/hide control appears.
  _verify: unit_
- **AC-6**: Given the graph in VS Code in a light and a dark theme, when the
  panel is hidden and shown again, then the control is findable without
  knowing it is there, is legible in both themes, and hiding the panel leaves
  the graph itself unobscured.
  _verify: human_
- **AC-7**: Given the panel hidden, when VS Code is reloaded and the graph
  opened on the same view, then it is still hidden.
  _verify: ui_

## Out of scope

- A `foam.graph.showControls` setting, or a `showControls` key in
  `foam.graph.views`. Display options are not settings — see the Context. A
  user who wants the panel gone gets there with one click, and it stays gone.
- A keyboard shortcut for the toggle. The issue offers it as an alternative to
  the button, not in addition; a button alone is the smaller thing and is
  discoverable, which a shortcut is not.
- Collapsing the panel to its header, or making the panel narrower, movable
  or resizable. Hidden or shown, nothing between.
- Saving which of the panel's sections are open. AC-2 asks for them across a
  hide and a show, which a panel that stays on the page keeps by itself;
  persisting them per view, so a reload opens the sections the user left
  open, is a separate thing and not asked for here.
- Changing what `showControls` means for hosts embedding `<foam-graph>`.
- Hiding the panel from the extension side — a `foam-vscode.show-graph`
  argument or a command-palette entry.

## Open questions

- The reporter asked for a setting, and will get a toggle instead. If the
  maintainer wants the declarative route as well — a view in
  `foam.graph.views` that opens without controls — it is a field on
  `GraphViewConfig` and an addition to this spec, not a different one. Assumed
  not wanted, since it is the route #1205 moved away from.
