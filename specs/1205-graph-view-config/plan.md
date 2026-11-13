# Plan: Graph view preferences

## Approach

The state to persist already exists in one place: the `FoamGraph` Lit element
(`packages/foam-graph/src/foam-graph.ts`) owns every interactive display
field — `showNodesOfType`, `labels`, `forces`, `selection`, the size/width
multipliers, `animateLinks`, `localStylePatch`, `groups`, `graphScope` — and
the control panel is stateless, emitting events the element handles. So the
mechanism is: give the element a `getViewState()` snapshot and an
`applyViewState()` restore of exactly those fields, define the
`GraphViewState` type next to the other contract types in
`packages/foam-graph/src/protocol.ts`, and add one message pair —
`didRestoreViewState` (extension → webview, sent between `didUpdateStyle`
and the first `didUpdateGraphData` in the `webviewDidLoad` handler) and
`webviewDidChangeViewState` (webview → extension, debounced in `main.ts` so
slider drags don't flood). The extension persists the payload in
`ExtensionContext.workspaceState` under a single key holding
`Record<viewName, GraphViewState>`, following the Memento usage already in
`packages/foam-vscode/src/vscode/services/cache.ts`. Restore-then-data
ordering works with the existing pipeline because `deriveNodeTypeFilters`
(`packages/foam-graph/src/lib/graph-view-model.ts:57`) only fills in types
that are `null` in the current map — restored filters survive data arrival,
new types still appear.

Truncation moves to paint time. `generateGraphData` stops passing
`transformTitle` (`packages/foam-vscode/src/vscode/features/graph-webview/index.ts:102`),
so full titles cross the wire (`transformTitle` itself stays in
`@foam/core` — the CLI and site export still use `buildGraphData`). A pure
`truncateLabel(title, maxLen)` helper goes in a new
`packages/foam-graph/src/lib/labels.ts` and is applied where the canvas
draws the label (`packages/foam-graph/src/components/graph-canvas.ts:272`),
which is type-agnostic — placeholders are truncated because nothing special
happens to them anymore. Truncating at paint rather than in the model
matters: group rules match on `title` substrings
(`lib/groups.ts`), so the model must keep the full text. `labelMaxLength`
becomes a field of `GraphViewState` with default 24 and a control-panel
input next to the existing label-fade slider.

The setting removal is mechanical and ends at the boundary: the
`foam.graph.titleMaxLength` contribution in
`packages/foam-vscode/package.json:958`, `cutTitle`, and the dead plumbing —
`getGraphTitleMaxLength` in `packages/foam-vscode/src/vscode/config.ts:182`,
and in `@foam/core` the `graphTitleMaxLength` field/getter/parse in
`src/vscode-settings.ts` (lines 29, 100, 252) and the interface/default/static
trio in `src/config.ts` (lines 51, 117, 148, 195) — none of which has a
functional caller besides `cutTitle`.

## Work breakdown

1. `packages/foam-graph/src/protocol.ts`: add `GraphViewState` (the fields
   listed above plus `labelMaxLength`), extend `ExtensionMessage` with
   `didRestoreViewState` and `WebviewMessage` with
   `webviewDidChangeViewState`.
2. `packages/foam-graph`: `labels.ts` helper + test; apply it in
   `graph-canvas.ts` with `labelMaxLength` passed down as a property;
   `getViewState`/`applyViewState` on `FoamGraph`, a `view-state-change`
   event dispatched from the mutating handlers; max-label-length control in
   `control-panel.ts` following the existing slider rows; wire both message
   directions in `main.ts` with the debounce.
3. `packages/foam-vscode/src/vscode/features/graph-webview/`: a small
   view-state store module over a `Memento` (per-view bucket merge that
   spreads unknown top-level buckets and unknown fields through untouched);
   in `index.ts`, handle `webviewDidChangeViewState` and send
   `didRestoreViewState` on `webviewDidLoad` and on a view switch over a
   live panel, resolving the view name from the panel title in both
   directions.
4. Remove the setting and plumbing (work item above); drop `cutTitle` and
   the `transformTitle` argument in `generateGraphData`.
5. Tests per the map below.

## AC verification map

- AC-1 → `packages/foam-vscode/src/vscode/features/graph-webview/graph-webview.test.ts`
  (reads the extension's `package.json` contributions; plus
  `generateGraphData` output unaffected by a configured value in the mock)
- AC-2 → `packages/foam-vscode/src/vscode/features/graph-webview/graph-webview.test.ts`
  (`updateGraph` against a mock panel: payload titles are full length)
- AC-3 → `packages/foam-graph/src/lib/labels.test.ts` (truncation incl. the
  `<= 0` disable; the paint path is type-agnostic, see Risks)
- AC-4 → `packages/foam-graph/src/foam-graph.test.ts` (apply a view state
  with a new `labelMaxLength`, assert it reaches the canvas binding)
- AC-5 → `packages/foam-vscode/.../graph-webview.test.ts` (the exported
  message handler with a `MapBasedMemento`: `webviewDidChangeViewState`
  writes, a fresh handler's `webviewDidLoad` replays for the same view name
  only — handler-level rather than through `setupGraphPanel`, whose
  `getWebviewContent` reads build output from disk)
- AC-6 → human (reload window, reopen graph)
- AC-7 → `packages/foam-vscode/.../graph-webview.test.ts` (store round-trip
  preserves unknown buckets and unknown fields)
- AC-9 → `packages/foam-graph/src/foam-graph.test.ts` (filters restored via
  `applyViewState`, then `graphData` arrival does not clobber them) and the
  AC-5 test exercising the same round-trip at the feature layer
- AC-10 → `packages/foam-graph/src/foam-graph.test.ts` (reset re-layers
  defaults → declared style), `packages/foam-graph/src/host-bridge.test.ts`
  (pending save dropped, reset message carries the view name) and
  `packages/foam-vscode/.../graph-webview.test.ts` (only that bucket is
  deleted)

## Decisions

The spec has no open questions left; these are the calls made while planning:

- **Current view name tracking** → the view name travels with the
  messages: every `didRestoreViewState` carries it (sent on every load and
  on every actual view switch, even with an empty state), and the webview
  echoes it back with each save, so a save debounced across a view switch
  still lands in the bucket it was made in. The panel title
  (`"Foam Graph: <view>"`) is parsed only to recover the view after
  `deserializeWebviewPanel` (which gets no view argument) and as the save
  fallback before any restore has been delivered.
- **Restores use replace semantics** → `applyViewState` resets to built-in
  defaults, re-applies the declared style, then the saved state; and a
  restore is sent even when nothing is saved. Otherwise one view's
  interactive tweaks leak into the next view shown and get persisted
  there. Re-invoking `show-graph` for the already-open view sends no
  restore, so stale saved state cannot snap back mid-interaction.
- **Save-loss windows are flushed** → the webview flushes a pending
  debounced save before applying an incoming restore (preserving the old
  view's last gesture) and on `pagehide` (best effort for "change one
  thing and close the panel").
- **`showNodesOfType` merges key-wise in the store** → the webview's
  filter derivation drops entries for types currently absent from the
  graph; a plain overwrite on save would turn that into permanent loss of
  a saved preference once the type reappears.
- **Labels are truncated into a cache**, rebuilt when `visibleGraph` or
  `labelMaxLength` changes — the paint loop runs per node per frame, so
  truncating there would allocate per frame.
- **Default bucket name** → `"Default"`, the same name `resolveViewStyle`
  already falls back to (`graph-webview/index.ts:287`), so a nameless open
  and the `Default` named view share state by construction, matching the
  spec's "default bucket" language. An inline-config-only invocation (no
  `view` name) also lands there.
- **`graphScope` is persisted** → it's a control-panel control like the
  rest; restoring a focus scope with no selection degrades gracefully
  because `visibleFocusNodeId` returns null and the full graph shows
  (`foam-graph.ts:96-100`).
- **Saved state wins over the view's declared config at open** → restore is
  applied after `didUpdateStyle`. This is the spec's "preferences record the
  user's last interactive choices", and it means a later edit to a view's
  `show`/`groups` in settings.json is masked for buckets that already have
  saved state. The escape hatch is the panel's reset button (AC-10): the
  webview re-layers defaults → declared style and tells the extension to
  delete that view's bucket. It is a separate message rather than a save of
  the reset state, since a full snapshot would freeze the declared config
  into the bucket again. A save still pending in the debounce is dropped, or
  it would recreate the bucket.
- **Debounce in the webview (`main.ts`), not the extension** → keeps the
  store write path trivial and the message volume low at the source.

## Risks

- **AC-3 is proven at the helper, not the canvas.** Unit tests can't assert
  pixels; if `truncateLabel` were applied in the wrong place (model instead
  of paint), group-by-title matching would regress — covered by adding a
  case to `lib/groups.test.ts`-adjacent assertions in `foam-graph.test.ts`
  (full title retained in model while canvas receives the truncation
  length). Final visual check is AC-6's human pass.
- **The real webview↔extension round-trip is only e2e-reachable.**
  `graph-webview.spec.ts` can open the panel but cannot click inside the
  webview, so persistence through a live host rests on the unit tests of
  both halves plus AC-6. If that feels thin after implementation, a spec
  asserting the panel opens clean with a pre-seeded `workspaceState` is the
  cheapest wiring check.
- **Stale buckets.** Renamed/deleted views leave orphaned state; harmless by
  AC-7's own semantics. Reset only clears the open view's bucket.
- **Groups double-up.** A view that declares groups and has saved state will
  show the saved copy (which includes those groups as last seen). Consistent
  with saved-state-wins, but a possible surprise for users.
