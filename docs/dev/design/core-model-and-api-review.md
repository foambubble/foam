# Core Model & API Review — Improvement Spec

- **Date:** 2026-08-09
- **Scope:** `@foam/core` information model and services, package/API architecture, and the seams to `foam-vscode`, `@foam/cli`, and `@foam/mcp`. Performance items are included where they fall out of the model review.
- **Method:** full read of `packages/foam-core/src/model/*` and `src/services/*`, the export subsystem, the consumer packages' integration points, the perf instrumentation (`load-profiler`, benches, `scripts/perf/gate.mjs`), and the open issue tracker. Every finding cites `file:line` against commit `8b03256`.
- **Legend:** each proposal carries **Effort** (S ≈ hours, M ≈ 1–3 days, L ≈ 1–2 weeks+), **Breaking** (against the `@foam/core` public surface in `packages/foam-core/src/index.ts`, or user-visible behavior), and **Impact** with rationale.

---

## Executive summary

The core model is in good shape structurally — the reversed-trie workspace index, the incremental graph, the `PublishTarget` export abstraction, and the perf-gate CI are all well-designed. The review found no architectural rot, but it did find:

1. **A handful of genuine correctness bugs**, including one silent data-loss case in the workspace index (case-colliding filenames), a divergence between the incremental graph and a full rebuild, and rename/edit paths that can corrupt files (no overlap detection, duplicated definition edits).
2. **A semantic gap advertised but not implemented:** aliases are offered by link completion but never participate in link resolution, so the extension can suggest a link it will then render as broken.
3. **Lifecycle leaks** (tags never disposed, providers never disposed, one failing feature aborts the whole extension activation and strands live resources).
4. **Avoidable hot-path costs** that map directly onto the two open perf issues (#1375, #1689): a wasted nested tree-walk in the block parser, an O(n·m) file matcher, a full SHA-1 + deserialize on every parser-cache *hit*, and a full-workspace clone per rename.
5. **API-surface debt:** a 297-symbol barrel of which ~34% has no in-repo consumer, host concerns embedded in the platform-agnostic core (telemetry endpoint, VS Code-only config getters), and duplicated serializers that make the CLI and MCP emit different wire formats for the same data.
6. **Doc drift:** `CLAUDE.md` describes the pre-`foam-core` repo layout and actively misdirects contributors (and agents).

The roadmap at the end sequences these into four phases. Phase 1 (correctness + leaks) is entirely non-breaking and roughly two weeks of work; the breaking items are concentrated in Phase 4 and can ride a single minor/major release.

---

## 1. Correctness fixes

### 1.1 Case-colliding filenames silently overwrite each other in the workspace index

`FoamWorkspace` keys its trie by a reversed, **lowercased** path (`workspace.ts:350-365`, `normalize` at `:528`). `/a/Note.md` and `/a/note.md` produce the identical key, so the second file **replaces** the first in `_resources`, and `set()` emits `onDidUpdate` instead of `onDidAdd` (`workspace.ts:127-137`) — which then desynchronizes the graph (it disconnects the old path while connecting the new one, leaving stale backlinks). The existing #1303 regression test (`workspace.test.ts:187-209`) uses files in *different* directories, so this collision is untested. The model currently has two incompatible notions of identity: `find(URI)` is case-insensitive while `URI.isEqual` (`uri.ts:236-244`) is case-sensitive.

**Proposal:** store exact-case keys in the trie with a case-insensitive lookup layer (bucket resources under the lowercased key), define identity policy in one place, and add the missing same-directory regression test.

**Effort:** M · **Breaking:** No (fixes a currently-broken case) · **Impact:** High — silent data loss in the model; affects any vault with case-variant filenames (common on case-sensitive filesystems / git checkouts).

### 1.2 Incremental graph diverges from a rebuild when an added file changes a non-placeholder resolution

`onResourceAdded` (`graph.ts:140-144`) only re-resolves sources currently pointing at a *placeholder*. But adding a file can also change resolution of a link that already resolves to a real note, because ambiguity is broken by path sort (`workspace.ts:290`) and directory-index suffix match (`workspace.ts:229-239`). Example: `[[attachment-a.pdf]]` resolves to `/path/to/more/attachment-a.pdf`; adding `/path/to/attachment-a.pdf` should re-point it — the full-rebuild path asserts exactly this (`graph.test.ts:183-221`), the incremental path misses it. The comment at `graph.ts:136-138` acknowledges the missing inverse-resolution capability. `graph-incremental.test.ts` has no "add steals an already-resolved target" case, and the `[flat]` perf gate (`workspace-graph.bench.ts:132-142`) only covers the update path.

**Proposal:** on add, additionally reconnect sources whose links resolve *by identifier* to the new resource's basename (the workspace can expose "which identifiers does this URI answer to"); add the missing incremental test and extend the scaling bench to add/delete paths.

**Effort:** M · **Breaking:** No · **Impact:** High — the graph (backlinks panel, orphans, graph view) is quietly wrong after a common operation until the next full reload.

### 1.3 Rename/edit pipeline can corrupt files

Three compounding defects:

- `TextEdit.apply` (`text-edit.ts:18-50`) has **no overlap detection** — overlapping ranges silently corrupt the document.
- The parser resolves every reference link to the **same `NoteLinkDefinition` object** (`markdown-parser.ts:204-206`), so a file with `[a][ref]` and `[b][ref]` makes `heading-edit` emit **two edits with the identical range** (`heading-edit.ts:85-118`, `:215-247`) — no dedup anywhere, including `commands/rename.ts:47-67`. Combined with the missing overlap check, the definition line is rewritten twice.
- `createUpdateLinkEdit` throws on external links (`markdown-link.ts:100-102`) and `heading-edit.ts:126` calls it outside its try/catch, so one odd link aborts an entire rename.

**Proposal:** dedupe edits by range before applying; make `TextEdit.apply` throw on overlaps; guard the `analyzeLink`/`createUpdateLinkEdit` call sites consistently. Add the `[a][ref] + [b][ref]` test.

**Effort:** S · **Breaking:** No · **Impact:** High — these are the operations users trust most (rename heading/block across the vault); failure mode is silent file corruption.

### 1.4 CLI/MCP rename leaves markdown-style links dangling

`link-integrity.ts:71` only rewrites `wikilink` connections; markdown `[text](note.md)` links are documented as "delegated to VS Code built-in" (`link-integrity.test.ts:134`). That fallback exists only in the editor — `commands/rename.ts:112` and `commands/note.ts:306` are the CLI/MCP path, where markdown links silently break on rename.

**Proposal:** handle `link.type === 'link'` in `link-integrity`, optionally behind a `linkTypes` option so the VS Code host can keep delegating.

**Effort:** M · **Breaking:** Behavior change for CLI/MCP renames (strictly a fix) · **Impact:** High for CLI/MCP users — renames are currently unsafe outside the editor.

### 1.5 Tag range extraction has wrong-position bugs

- Frontmatter tag ranges use substring search (`markdown-parser.ts:384-386`): tag `foo` matches inside `foobar` on an earlier line, producing a wrong range — and `TagEdit` writes edits at exactly those ranges.
- Hashtag ranges assume a single-line text node (`markdown-parser.ts:399-408`): a `#tag` on the second line of a multi-line paragraph gets a range on the wrong line/column. All existing tests use single-line paragraphs.
- `tag-edit.ts:79-85` distinguishes hashtag vs frontmatter tags by comparing the **range length**, coupled invisibly to how the parser computes ranges two files away.

**Proposal:** fix both range computations (word-boundary anchoring; newline-aware offset mapping) with targeted tests, and add a `source: 'inline' | 'frontmatter'` discriminator to `Tag` (`note.ts:75-78`) so `tag-edit` drops the heuristic (requires a `CACHE_VERSION` bump in `foam-vscode/src/vscode/services/cache.ts:37`).

**Effort:** M · **Breaking:** `Tag` field addition is additive; cached-resource schema bump only · **Impact:** Medium-High — tag rename writes edits at wrong positions in these cases; also unblocks #1240-adjacent tag work.

### 1.6 Assorted small correctness fixes (batch)

| Fix | Where |
|---|---|
| `useAngles` off-by-one: target *starting* with a space isn't angle-wrapped | `markdown-link.ts:124`, `note.ts:55` (`indexOf(' ') > 0` → `includes(' ')`) |
| Missing null check: `workspace.find(source)` result dereferenced | `markdown-provider.ts:205` |
| `.sort()` without comparator on objects — sorts nothing | `markdown-provider.ts:280` |
| `/m` vs `/gm` inconsistency stripping block-anchor markers | `markdown-provider.ts:55` vs `:68` |
| `String.replace` with string containing user text interprets `$` patterns | `tag-edit.ts:238` |
| Attachment extension case inconsistency: `photo.PNG` accepted but misclassified | `attachment-provider.ts:39,65-67,71` |
| Watcher change handler race: two rapid changes to one file, last *read* wins not last *event* | `foam.ts:69-73` — serialize per-URI |
| Frontmatter `tags` line lookup can be `undefined` → tags silently vanish | `markdown-parser.ts:376-378` |

**Effort:** S (one batch PR) · **Breaking:** No · **Impact:** Medium — each is small, but all are user-visible in edge cases and cheap to fix together.

---

## 2. Lifecycle & resource management

### 2.1 `foam.dispose()` leaks `FoamTags`; workspace never disposes providers

`bootstrap`'s disposer (`foam.ts:110-114`) disposes subscriptions, workspace, and graph — never `tags`, whose three workspace listeners (`tags.ts:41-45`) and emitter leak. `FoamTags.dispose()` itself also skips its emitter (unlike `FoamGraph.dispose()`, `graph.ts:263-265`). Separately, `FoamWorkspace.dispose` (`workspace.ts:460-464`) never disposes registered providers even though `ResourceProvider extends IDisposable` (`provider.ts:6`).

**Proposal:** fix both; better, give `Foam` a `DisposableStore` so new members can't be forgotten.

**Effort:** S · **Breaking:** No · **Impact:** Medium — leaks on every reload/deactivate cycle; matters for long-lived hosts and the embeddable MCP library.

### 2.2 One failing feature aborts extension activation and strands live resources

`extension.ts:174` joins all features with `Promise.all`; a single rejection means `context.subscriptions.push(foam, watcher, parserCache, …)` at `:185` never runs — `Foam`, the watcher, and the parser cache stay alive and undisposed, and `extendMarkdownIt` is silently lost (preview loses all Foam rendering). Features are anonymous functions (`features/index.ts:15-28`), so the error can't even name the culprit.

**Proposal:** switch to `Promise.allSettled` with per-feature error logging; push core resources into `context.subscriptions` immediately after bootstrap; give features an `id` (and optional `supports: 'node' | 'web'`) — `interface FoamFeature { id; supports?; activate(ctx, foam) }`. The `id` also fixes the acknowledged telemetry-key collision risk (`types.d.ts:11-12`) and gives the web build a declarative way to skip Node-only features (see §6.2).

**Effort:** M · **Breaking:** No (internal to the extension) · **Impact:** High — converts "any feature bug bricks Foam" into "one feature degrades".

### 2.3 Leaked registrations in graph-webview

`graph-webview/index.ts:21` (`onDidChangeConfiguration`) and `:62` (`registerCommand('foam-vscode.show-graph', …)`) discard their disposables; every other feature pushes them into `context.subscriptions`.

**Effort:** S · **Breaking:** No · **Impact:** Low — orphaned registrations on deactivate/reactivate.

### 2.4 Honor `FoamTags`' `debounceFor` parameter

`tags.ts:33` accepts `debounceFor` but `:40` hardcodes `debounce(..., 500)` — the value is used only as an on/off flag, and `bootstrap` never passes it, so tags are undebounced in production.

**Effort:** S · **Breaking:** No · **Impact:** Low alone; pairs with §3.4.

---

## 3. Performance

These target the two open perf axes tracked by the bench suite (`workspace-graph.bench.ts:14-30`, #1375) and the slow-load report (#1689, `load-profiler.ts:13-14`). The perf-gate CI (`scripts/perf/gate.mjs`: fail at 2.0×, warn at 1.3×; `[linear]`≤1.8, `[flat]`≤1.0 normalized) will verify each claim.

### 3.1 Block parser does a wasted nested tree-walk per node

`blocksPlugin.visit` (`markdown-parser.ts:509-518`) calls `getDirectText(node)` — itself a **full subtree visit** (`:332-340`) — for every paragraph/listItem/blockquote/heading, then discards the text whenever there's no `^` block anchor, which is nearly always. This is a constant-factor ~2× traversal on flat documents and O(n·depth) on nested ones — the single largest avoidable cost in the parse path, which the profiler already identifies as the load bottleneck (`load-profiler.ts:218-219`, parse is super-linear in note size). Also: `note.blocks.some(...)` in the same loop is O(blocks²) (`:537`), and each own-line blockquote anchor re-splits the whole source (`:570`).

**Proposal:** gate `getDirectText` on a cheap "does this node's source range contain `^`" check; replace the `some` with a `Set`; split the source into lines once per parse and share with the footnote scan (`:237`).

**Effort:** S · **Breaking:** No · **Impact:** High — directly attacks #1689/#1375; expected double-digit-% parse-time reduction on typical vaults, verifiable in `markdown-parser.bench.ts`.

### 3.2 Parser cache hits still pay SHA-1 + full deserialize

`cachedParser` (`markdown-parser.ts:275-301`) hashes the entire document (SHA-1, `utils/core.ts:49`) on every call, and a hit still runs `Resource.fromJSON` (`foam-vscode/src/vscode/services/cache.ts:201-210`). During typing this is the hot path, and the profiler reports it as a cheap "hit".

**Proposal:** let the host pass a cheaper validity token (document version/mtime) so unchanged documents skip hashing entirely; collapse `cache.has` + `cache.get` into one call; consider memoizing the last deserialized resource per URI.

**Effort:** M · **Breaking:** No (additive cache API) · **Impact:** Medium-High — removes per-keystroke work proportional to note size.

### 3.3 O(n·m) file matcher on the VS Code hot path

`FileListBasedMatcher.match()` filters with `Array.includes` over a `string[]` (`datastore.ts:168-170`); `isMatch` is O(n) per call. This is the matcher VS Code selects in the common case (`editor.ts:495-502`) — on a 10k-file vault a single `match(allFiles)` is ~10⁸ comparisons. The class carries its own "to be refactored later" note (`:150`).

**Proposal:** back it with a `Set<string>`. While in there: its `include`/`exclude` fields are decorative (never consulted) — either wire or remove them. This is also the natural place to add **`.gitignore` support (#1388)**, the most-requested open datastore issue.

**Effort:** S (Set) + M (gitignore) · **Breaking:** No · **Impact:** Medium-High — removes a quadratic on load and on every matcher refresh; #1388 has standing user demand.

### 3.4 `FoamTags` rebuilds the entire tag index on every file event

`tags.update()` (`tags.ts:51-61`) is a full O(total tags) rebuild wired to all three workspace events (`:42-46`), unlike the graph which is incremental. Every panel listening to `tags.onDidUpdate` then refreshes wholesale.

**Proposal:** incremental update using the `{old, new}` payload the workspace already provides (index tag locations by resource as well as label).

**Effort:** M · **Breaking:** No · **Impact:** Medium — flattens per-edit cost in tag-heavy vaults; pairs with §2.4 and §4.6.

### 3.5 `link-integrity` clones the whole workspace per rename

`buildFutureWorkspace` (`link-integrity.ts:13-26`) copies every resource into a fresh `FoamWorkspace` to answer one identifier question — a full second index per rename on large vaults.

**Proposal:** an overlay resolver over the live workspace (consult the overlay first, fall through).

**Effort:** M · **Breaking:** No · **Impact:** Medium — rename latency on large vaults.

### 3.6 Other measured/mechanical wins (batch)

- `_unregisterDirectoryIndex` is O(workspace) on every delete of an index file (`workspace.ts:185-212`) → keep per-directory candidate lists.
- `TextEdit.apply` builds a per-character array per edit (`text-edit.ts:22-50`) → offset-based slice concatenation.
- Per-node plugin dispatch re-enters a try/catch and probes 6 optional methods per AST node (`markdown-parser.ts:183-189`) → precompute the visitor list per parser.
- `getTagAtPosition` scans all tags × locations per call (`tag-edit.ts:265-283`) → per-URI index.
- CLI gets neither parser cache nor profiler (`foam-cli/src/support/filesystem.ts:172`) → wire both; big cold-start win for CLI/MCP and export.
- Profiler hygiene: no `reset()` (double-counts on second load), chars misreported as MiB (`load-profiler.ts:63-67`, `:147`, `:237`).

**Effort:** S-M per item · **Breaking:** No · **Impact:** Medium in aggregate.

### 3.7 (Strategic) Replace remark-parse v8 / unified v9 with micromark

The pinned parser stack is several majors behind. It is the root cause of: the regex-based footnote scan (`markdown-parser.ts:231-268`), the collapsed consecutive-footnote ASTs, likely the documented super-linear parse scaling, and the wikilink-in-math false positives (#1317). The bench file already ships an A/B harness for exactly this migration (`markdown-parser.bench.ts:97-101`).

**Proposal:** migrate to `micromark`/`mdast-util-from-markdown` behind the existing `ParserPlugin` seam; prove parity with the golden-file tests and the A/B bench before switching.

**Effort:** L · **Breaking:** Potentially (AST-shape-dependent plugins; parse edge cases change) · **Impact:** High long-term — removes a whole class of workarounds and the main super-linear cost; should be scheduled, not rushed.

---

## 4. Information model evolution

### 4.1 Make aliases participate in link resolution

Aliases are parsed (`markdown-parser.ts:700-712`), stored on `Resource`, offered by **link completion** (`link-completion.ts:269`) and search — but `listByIdentifier` (`workspace.ts:266-291`) only ever consults paths. `[[my-alias]]` yields a placeholder even when a note declares `alias: my-alias`: the system suggests links it then fails to resolve. This is the single biggest semantic gap in the model.

**Proposal:** index aliases alongside basenames with documented precedence (exact path > basename > alias), behind a config flag initially (matching the `directoryMode` precedent, `markdown-provider.ts:24`).

**Effort:** M · **Breaking:** Behaviorally (previously-broken links start resolving — flag-gated) · **Impact:** High — closes a visible feature contradiction; frequently expected by users coming from Obsidian.

### 4.2 Normalize placeholder identity in the model

`URI.placeholder(path)` does no normalization (`uri.ts:99-101`): `[[page-b]]` and `[../page-b.md]` denoting the same missing file become **two distinct graph nodes** (pinned in `graph.test.ts:225-260`), so the placeholders panel shows duplicates. Placeholder construction is scattered across four sites in `markdown-provider.ts` (`:120,132,152,167`), and "placeholder-ness" is modeled three different ways (URI scheme `uri.ts:201-203`; a phantom `Resource.type === 'placeholder'` that the workspace never stores; a template-trigger type).

**Proposal:** a single model-owned placeholder factory that canonicalizes identity (workspace-resolved path where resolvable, raw text kept as label); remove the phantom resource type or promote it to a real variant.

**Effort:** M · **Breaking:** Yes — placeholder paths are visible in `graph.placeholders`, the panel, and tests · **Impact:** Medium-High — correct placeholder dedup, simpler consumers, prerequisite for sane "create note from placeholder" flows.

### 4.3 Split `FoamWorkspace.find` and fix its inconsistencies

`find(URI | string)` (`workspace.ts:367-415`) is three functions behind one signature (trie get / identifier resolution / path probing across roots), and it returns the **stored object** normally but a **fresh shallow copy** when the reference carries a `#fragment` (`:408-413`) — reference equality depends on argument syntax. Ambiguity resolution ("alphabetically first path wins") is encoded in a sort call (`:290`).

**Proposal:** explicit `findByUri` / `findByIdentifier` / `findByPath`; fragment handling returns `{resource, section}` instead of a patched copy; document the ambiguity policy. Keep `find` as a deprecated shim for one release.

**Effort:** M · **Breaking:** Yes (widely used in foam-vscode; mechanical migration) · **Impact:** Medium — the API's biggest ambiguity source; enables §1.2's identifier inversion cleanly.

### 4.4 Key the graph by full URI identity, not `uri.path`

`links`/`backlinks`/`placeholders` are `Map<uri.path, …>` (`graph.ts:21-29, 247-258`): in a virtual workspace `file:///notes/a.md` and `vscode-vfs://github/notes/a.md` collide (multi-scheme resolution is explicitly supported — `workspace.test.ts:303-326`); fragments are silently ignored, so callers must remember `.asPlain()` (done in five places in `commands/links.ts`). The same path-keyed pattern recurs in the export context (`export/types.ts:179,184`) and embeddings (`ai/model/embeddings.ts:39`).

**Proposal:** introduce a small `URIMap<T>` (canonical `scheme://authority/path` keying, explicit fragment policy) in `model/uri.ts` and use it in graph, export, embeddings. Make `getLinks`/`getBacklinks` normalize their argument.

**Effort:** M · **Breaking:** Yes for direct readers of `graph.links`/`graph.backlinks` (public mutable maps — see §4.5) · **Impact:** Medium — correctness on virtual/multi-root workspaces (web extension, remote repos), removes a caller ritual.

### 4.5 Encapsulate the graph/tags collections

`graph.placeholders/links/backlinks` and `tags.tags` are `public readonly` Maps — the reference is readonly, the contents are not; any consumer can `foam.graph.links.clear()`. Stored `Resource`s are also held by reference with no copy (`workspace.ts:131`), so in-place mutation corrupts the index and defeats the `{old, new}` update diff.

**Proposal:** accessor methods returning `ReadonlyMap`/iterators; document (or enforce via `Object.freeze` in dev builds) that `Resource` is immutable once stored.

**Effort:** S-M · **Breaking:** Yes, mechanical · **Impact:** Medium — removes a foot-gun class; prerequisite for safely evolving internals (§4.4).

### 4.6 Batchable events with payloads

`workspace.clear()` fires one delete per resource (`workspace.ts:149-158`) → N graph mutations + N full tag rebuilds + N panel refreshes; there is no batch/transaction primitive even though `PauseableEmitter`/`EventBufferer` already exist (`common/event.ts:749, 878`). `graph.onDidUpdate` and `tags.onDidUpdate` are `Event<void>`, so all ~7 VS Code listeners can only blanket-refresh. Delivery is synchronous and re-entrant (`common/event.ts:706-733`).

**Proposal:** additive first — `onDidChangeBatch: Event<Change[]>` on the workspace, used by `clear()` and bulk load; a debounced aggregate `Foam.onDidChangeWorkspace` (the preview feature currently hand-rolls this from three subscriptions, `preview/index.ts:20-30`). Later, upgrade `onDidUpdate` to carry a delta (breaking for listeners).

**Effort:** M (additive) + S (listener migration) · **Breaking:** Additive now; delta payload later is breaking · **Impact:** Medium-High — turns O(N) panel refresh storms into O(1); foundation for scaling to large vaults.

### 4.7 Type-model tightening

- `Resource.type: string` → union `'note' | 'attachment' | 'image'` (`note.ts:146`); `properties: any` → `Record<string, unknown>` (`:147`). **Breaking**, mostly mechanical.
- `ResourceLink.definition?: string | NoteLinkDefinition` encodes a three-state machine decoded by four predicates with order-sensitive call sites (`note.ts:5-44`; `markdown-provider.ts:94-138`) → discriminated union `{kind: 'inline'} | {kind: 'ref-unresolved'; label} | {kind: 'ref-resolved'; definition}`. **Breaking** (parser + tests construct it).
- `Connection` (`graph.ts:8-12`) carries no resolution provenance → add `resolvedBy: 'path' | 'identifier' | 'directory-index' | 'placeholder'`; every consumer currently re-derives this. **Additive.** Also directly serves typed-links exploration (#1626).
- URI derivations (`getDirectory`, `joinPath`, …) preserve `fragment`/`query` (`uri.ts:125-152`), yielding directories with section anchors; `asPlain()` exists solely to undo it → drop fragment/query on parent/derivation ops. **Non-breaking in practice** (all call sites strip or have none).
- `asAbsoluteUri` (`uri.ts:465-493`) disagrees with `FoamWorkspace.resolveUri` on the primary case (`uri.test.ts:131-140` vs `workspace.test.ts:277-281`) and is publicly exported → redefine in terms of `resolveUri` or remove. **Breaking.**
- Dead indirection: `pathToPlaceholderId` is the identity function (`graph.ts:14`); `wikilinkPlugin.onDidVisitTree` is an empty function (`markdown-parser.ts:798-801`); duplicate `CancellationToken` in `progress.ts:21-24`. Delete. **Non-breaking.**

**Effort:** S-M per item · **Impact:** Medium — compile-time safety over runtime predicates; cheapest during the same release that takes §4.3/§4.4.

### 4.8 Parser instance isolation

`sectionStack` is module-level mutable state shared by every parser instance (`markdown-parser.ts:416`), and `onDidInitializeParser` mutates the module-level `unified` processor (`:63, :105`) so `extraPlugins` from one `createMarkdownParser` call leak into all others. Safe today only because parsing is synchronous and single-instance.

**Proposal:** per-instance processor; per-parse context object threaded through `ParserPlugin` (breaking for the plugin interface, which has few implementors).

**Effort:** M · **Breaking:** Yes (plugin interface) · **Impact:** Medium — prerequisite for embedded-note parsing, parallel parse, and the §3.7 migration.

---

## 5. API & package architecture

### 5.1 Tier and split the public API surface

`@foam/core` exposes a single 315-line barrel re-exporting **297 symbols**; cross-referencing all three in-repo consumers, **~102 are never imported by anyone**. Output is CJS-only, so importing `URI` drags in jexl, the export pipeline, and lint rules — the web bundle and MCP pay for subsystems they never call.

**Proposal:** add subpath exports (`@foam/core/model`, `/export`, `/query`, `/lint`) and ESM output alongside CJS; split the barrel into a documented contract tier and an internal tier; add an API-report CI check (api-extractor or attw). Root barrel should delegate to per-subsystem `index.ts` curators — today `src/index.ts:194-239` hand-duplicates `export/index.ts`'s list and the two have already diverged.

**Effort:** M-L · **Breaking:** Additive now; demoting unused symbols is breaking for hypothetical external users only · **Impact:** High — bundle size for web/MCP, and it establishes the semver contract *before* external consumers depend on accidental surface.

### 5.2 Move host concerns out of core

- The App Insights connection string and envelope builder live in the platform-agnostic core (`telemetry.ts:158-159`, exported at `index.ts:180-184`). The string is deliberately a non-secret ingestion key, but a product's telemetry destination is deployment config, not library code — any fork/embedder silently inherits Foam's endpoint.
- `IFoamConfig` (`config.ts:1-46`) carries ≥8 editor-UI getters (`getGraphOnStartup`, `getPreviewEmbedNoteType`, `getCompletionLabel`, …) that a headless CLI is forced to stub (`foam-cli/src/support/config.ts:60-65`).
- `Config` is a mutable process-global singleton (`config.ts:149-166`) with exactly one core reader (`template-discovery.ts:15`) — a real hazard for `@foam/mcp`, which is meant to be embeddable (two workspaces in one process can't differ).

**Proposal:** core keeps `ITelemetryReporter` + bucketing only; endpoint + consent copy move to hosts. Split `CoreConfig` (files, templates, daily notes) from host config. Thread config explicitly (`getTemplatesDir(rootUri, config)`), retire the global.

**Effort:** M · **Breaking:** Yes — small, in-repo call-site count (≤5) · **Impact:** Medium-High — makes core genuinely embeddable and forkable; unblocks publishing `@foam/mcp`.

### 5.3 Retire the `foam-vscode` shim layer; repatriate stranded platform-agnostic code

Four directories in `foam-vscode/src` have zero `vscode` imports: `src/core/` (a second `bootstrap` whose 8th positional parameter *diverges* from core's — `foam-vscode/src/core/model/foam.ts:23-32` vs `foam.ts:32-42`, an accident waiting to happen), `src/ai/model` + `src/ai/services` (382-line `FoamEmbeddings`, pure core), `src/lint/`, and `src/daily-note/`. The shim type also makes the feature registry contravariantly unsound — it only compiles because `strict: false`.

The lint case is user-visible: the four wikilink rules (`rule-check-links.ts:22`) are only reachable by the editor, so **`foam lint` in CI cannot catch broken wikilinks** while the editor can (`foam-cli/src/commands/lint.ts:14-18`). Relatedly, `lintNote` hardcodes its rule list while `lintWorkspace` takes `rules[]` (`lint.ts:47-49, 86`) — two extensibility models in one file.

**Proposal:** move embeddings/lint/daily-note logic into core (embeddings as an optional `Foam` member; Ollama provider stays host-side); make core's `bootstrap` take an options object (it has **nine positional parameters**); delete the shim. Align `lintNote`/`lintWorkspace` on injected rules + `defaultLintRules()`.

**Effort:** M-L · **Breaking:** `bootstrap` and `lintNote` signatures (3 and 2 call sites); rest is internal moves · **Impact:** High — one `bootstrap`, CLI lint parity (CI catches broken wikilinks), and unlocks `strict: true` for the extension.

### 5.4 Unify the CLI/MCP wire format

`foam-cli/src/support/serializers.ts` (148 lines) and `foam-mcp/src/serializers.ts` (203 lines) independently serialize the same nine core result types — and disagree: CLI emits absolute fs paths (`serializers.ts:45`), MCP emits workspace-relative POSIX paths with `placeholder:<id>` handling (`serializers.ts:52-55`). Same note, two encodings; CLI has no placeholder story at all.

**Proposal:** one `@foam/core/serialize` module owning the `Json*` types and URI encoding (option: `'fs' | 'workspace-relative'`); both hosts consume it. Prefer unifying on workspace-relative.

**Effort:** M · **Breaking:** CLI JSON output changes if unified (recommended; flag the old encoding) · **Impact:** Medium — consistency for scripts/agents consuming both surfaces; halves maintenance.

### 5.5 Honor the `IDataStore` contract; make capabilities explicit

The interface requires `list(pattern)` to filter (`datastore.ts:12-17`) but the VS Code implementation ignores the pattern entirely (`editor.ts:408` takes no parameter) — currently masked only because saved queries build their own store (`saved-store.ts:102-138`); any future `dataStore.list(glob)` call in the extension is a silent data bug. `GenericDataStore` also throws at runtime for the 4-of-6 optional operations while claiming the full interface (`datastore.ts:117-143`), and `read` conflates missing vs unreadable (both `null`, `:106-115`). None of the shipping implementations have direct tests.

**Proposal:** fix the VS Code `listFiles` to honor the glob; split `IReadableDataStore`/`IWritableDataStore` (or a capabilities probe); distinguish not-found from error; add the missing tests.

**Effort:** M · **Breaking:** Interface split is breaking (4 implementations, all in-repo) · **Impact:** Medium — closes a documented contract violation before it becomes a bug.

### 5.6 Packaging hygiene (batch)

- `@foam/core/test` relative-imports `../src/*`, forcing a dual-instance-of-`URI` alias hack in **three** vitest configs (`foam-vscode/vitest.config.mts:41-48` documents it), while `instanceof URI` is used in production (`convert-links-format.ts:26`); `test-utils` also imports `micromatch`, which is not a declared dependency, and there's no `files` allowlist so npm ships `src/`, `test-data/`, etc. → import via the package entry, fix deps, add `files`.
- `foam-vscode` duplicates 15 of core's dependencies as phantom runtime `dependencies` (nothing installs them; esbuild bundles) — version skew between the two `package.json`s would silently ship a different parser than tests run → move to `devDependencies`, single source of truth in core.
- `@foam/mcp` declares `"@foam/core": "*"` as a runtime dep, but core publishes under the name `foam-core` (`release.js:29-31`) — the moment `@foam/mcp` is published it cannot resolve → bundle like cli/vscode, or publish under the real name.
- Dead `cli` build target in `foam-vscode/esbuild.js:31,136-146,177-188` (the `src/cli/` it builds no longer exists) → delete.
- Three field-identical graph-data types (`graph-data-builder.ts:5-16`, `export/types.ts:126-144`, `foam-graph/src/protocol.ts:16-25`), with `build-site-graph.ts:12` compiling only by structural coincidence → alias the two in-core copies; keep the protocol copy as a deliberate wire contract with a compile-time compatibility assertion.
- `graph-data-builder.ts:75` ships the **entire raw frontmatter** into graph payloads consumed by the webview *and the published static site* — private frontmatter fields leak into published graph JSON → allowlist exported keys.

**Effort:** S-M per item · **Breaking:** No (except the frontmatter allowlist, a behavior fix) · **Impact:** Medium — the frontmatter leak in particular is a privacy fix for publishing.

---

## 6. Platform integrity (web / CLI parity)

### 6.1 Mechanically enforce "no Node imports in foam-core"

The invariant holds today by review only: core's `tsconfig` includes `"types": ["node"]`, so `process`/`Buffer` type-check fine. One lint rule (`no-restricted-imports` on `fs|path|os|node:*` in `packages/foam-core/src`) makes the repo's most important invariant enforceable.

**Effort:** S · **Breaking:** No · **Impact:** High leverage for the cost — prevents an entire regression class.

### 6.2 `export-html-page` ships broken in the web extension

It imports `fs/promises` directly (`export-html-page/index.ts:2,85,91`) and is registered unconditionally; the web build's `polyfillNode()` makes it *bundle* but not work. Two other fs-users get bespoke esbuild `onResolve` swaps (`esbuild.js:72-101`) — a substring-matching mechanism invisible from the source tree.

**Proposal:** route file I/O through `foam.services.dataStore` (already works in both hosts); replace the regex swap mechanism with explicit `.web.ts` twins or `browser` field mapping; use §2.2's `supports` field to gate genuinely Node-only features.

**Effort:** S (gate) + M (dataStore refactor) · **Breaking:** No · **Impact:** Medium — a visibly broken command in the web host today.

### 6.3 Path-string discipline cleanup

Per the repo's own URI convention: `grouped-resources-tree-data-provider.ts:1,85-89` runs Node `path.parse` on a URI component; `export/types.ts:72` accepts `contentRoot?: string | URI` (the one both-typed field in core's config surface — a `vscode-vfs://` workspace will resolve incorrectly); `foam-cli/src/support/filesystem.ts:28-34` reimplements core's `isWithinPath` under the same name with a different signature. Also export `getBasename`/`getExtension`/`getDirectory` from core's barrel — CLAUDE.md tells contributors to use them, but they aren't currently exported (`index.ts:151-158`), which is part of why reimplementations happen.

**Effort:** S · **Breaking:** `contentRoot: URI` only (2 in-repo call sites) · **Impact:** Low-Medium each; collectively keeps the convention honest.

---

## 7. Documentation

### 7.1 `CLAUDE.md` describes the pre-`foam-core` repository and actively misdirects

It states core lives in `packages/foam-vscode/src/core/` (now a one-file shim), features in `src/features/` (now `src/vscode/features/`), claims a `tsconfig` `paths` mapping for `@foam/graph-view` that doesn't exist, and recommends path utilities core doesn't export. `CONTRIBUTING.md:58-62` is *correct*, so the two root docs contradict each other. Also: `docs/user/features/templates.md:284` links to a moved file (user-facing broken link), and `docs/dev/testing-conventions.md:25` is stale.

**Proposal:** rewrite the structural sections of `CLAUDE.md` against the current tree and make it point to `CONTRIBUTING.md` for structure (the duplication is what drifted); fix the two stale doc links.

**Effort:** S · **Breaking:** No · **Impact:** High for contributor/agent effectiveness — this file is loaded into every AI-assisted session and currently sends it to the wrong directories.

---

## Prioritized roadmap

**Phase 1 — Correctness & leaks (all non-breaking; ~2 weeks)**
1.1 trie case collision · 1.2 incremental-add divergence · 1.3 edit corruption · 1.5 tag ranges · 1.6 small-fix batch · 2.1–2.4 lifecycle fixes · 5.6 frontmatter leak in published graphs · 6.1 core import lint · 7.1 CLAUDE.md rewrite

**Phase 2 — Performance (non-breaking; ~1–2 weeks; verified by the existing perf gate)**
3.1 block-parser walk · 3.3 matcher Set (+#1388 gitignore) · 3.2 cache-hit cost · 3.6 mechanical batch · 3.4 incremental tags · 3.5 rename overlay

**Phase 3 — Parity & packaging (mostly non-breaking; ~2 weeks)**
5.3 lint rules to core (CLI wikilink lint) · 1.4 CLI markdown-link rename · 6.2 web export fix + feature `supports` · 5.4 shared serializers · 5.6 packaging batch · 4.6 batch events (additive part) · 2.2 feature isolation + ids

**Phase 4 — Model & API evolution (breaking; one coordinated minor/major)**
4.1 alias resolution (flagged) · 4.2 placeholder identity · 4.3 `find` split · 4.4 `URIMap` graph keying · 4.5 collection encapsulation · 4.7 type tightening · 4.8 parser isolation · 5.1 API tiering + subpaths · 5.2 config/telemetry out of core · 5.5 datastore contract · **then** 3.7 micromark migration behind the A/B bench

**Issue cross-references:** #1375/#1689 (Phases 2, 4-parser), #1388 (3.3), #1240 (1.5/4.7 groundwork), #1317 + #1631 (3.7), #1626 (Connection provenance, 4.7), #1685 (safe to do alongside 3.2), #1303 (1.1 closes the remaining gap).
