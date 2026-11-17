---
type: feature
created: 2026-11-15
---

# Graph view options for embedding hosts

## Context

`<foam-graph>` is drawn one way: every node a filled circle, told apart from
other kinds by colour alone and sized by its link count. That suits the VS
Code panel, but a host with its own visual language cannot draw tags,
placeholders and notes as different shapes, and colour alone is a weak cue
for anyone who can't tell the colours apart. Hosts set per-type colours
today through the style; shape and size should be set the same way.

Embedding the view elsewhere also runs into three gaps, each confirmed in the
current code:

- **Tiny tap targets.** A node's hit area is its drawn circle: 2–12 px
  across at zoom 1, scaling with zoom. Touch guidelines ask for about 44 px.
- **No fit after the first graph.** The view fits a graph to its area once,
  on its first load. A host that replaces the graph later (a different
  neighbourhood, a filter change) has no public way to fit the new one; the
  canvas's own fit sits inside the element's shadow root.
- **It never stops painting.** Every link carries one particle whether or not
  it is drawn, so the canvas repaints every frame for as long as the graph is
  on screen, even with link animation off and nothing moving. That costs
  battery on a touch device and CPU in the VS Code panel alike.

Everything except the last is opt-in: with none of it set, the graph looks
and behaves as it does today, so the VS Code graph and the exported site are
unchanged. The repaint fix changes every host, for the better.

## Acceptance criteria

- **AC-1**: Given a style that draws a node type as a diamond, when the graph
  is drawn, then every node of that type is a diamond and every other node a
  circle. With no shape set, every node is a circle, as today.
  _verify: unit_
- **AC-2**: Given a style that draws a node type outlined, solid or dashed,
  when the graph is drawn, then each node of that type is its outline in the
  type's colour, and links do not show through it. With no outline set,
  nodes are filled, as today.
  _verify: unit_
- **AC-3**: Given a style that gives a node type a fixed size, when the graph
  is drawn, then every node of that type is that size whatever its link
  count; types with no size set still grow with their link count, as today.
  The node size control scales both alike.
  _verify: unit_
- **AC-4**: Given a node drawn with a set shape, outline or size, when it is
  highlighted or dimmed, then it keeps that shape, outline and size, and only
  its colour changes, as a circle's does today.
  _verify: unit_
- **AC-5**: Given a host that sets a minimum tap size of N px, when a point
  is within N/2 screen px of a node's centre, then it hits that node at any
  zoom, however small the node is drawn; a node drawn larger keeps its drawn
  area, whatever its shape. With no minimum set, the hit area is the drawn
  node, as today.
  _verify: unit_
- **AC-6**: Given a view already showing a graph, when the host gives it a
  different graph and asks it to fit, then once the layout has settled every
  visible node is inside the view, zoomed no further in than `maxFitZoom`
  when one is set. A fit asked for before the layout settles fits the
  settled layout. A host that does not ask keeps its pan and zoom when it
  sends updated data, as the VS Code graph does today while notes change.
  _verify: human_
- **AC-7**: Given a graph whose layout has settled and on which no link
  particle is visible — link animation off, or no link highlighted — when the
  view is left alone for 5 seconds, then it paints no frame. A hover, a tap,
  a selection from the host, a pan or a zoom on that idle view still repaints
  it at once, and a highlighted link with animation on still animates.
  _verify: human_
- **AC-8**: Given the view in a browser, once with a style that sets a
  diamond, a dashed outline and a fixed size on different types and once
  with none of them, when each graph is looked at in a light and a dark
  background, then the first shows those shapes crisply at every zoom, and
  the second looks as the VS Code graph does today.
  _verify: human_

## Out of scope

- Turning node dragging off, and how a selected node and the nodes away from
  it are drawn: considered, left for later.
- Shape or size for a single node. A node's `color` property already
  overrides its colour; nothing here does the same for shape or size.
- Label styles per node type.
- Shapes beyond circle and diamond.
- Declaring or documenting the new options as VS Code settings, or turning
  any of them on in VS Code or in the exported site. `foam.graph.style`
  reaches the view as written, so a user who adds the new keys there gets
  them, undocumented.
- Exposing them in the control panel or the saved view state: they are host
  configuration, like `maxFitZoom`, not user preferences.

## Open questions

- After a touch lifts, the view may keep the last-tapped node as hovered,
  so a node drifting under that point would light up. Not reproduced. If it
  is, it joins this spec as a criterion; until then it stays out.
