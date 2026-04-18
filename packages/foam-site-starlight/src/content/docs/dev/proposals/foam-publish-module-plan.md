---
title: " Module Plan"
description: "Published from /Users/riccardo/.codex/worktrees/a57a/foam/docs/dev/proposals/foam-publish-module-plan.md"
---
# `foam-publish` Module Plan

## Summary

`foam-publish` should be a build-time package that translates a Foam workspace into publishable artifacts for a website.

It should not be the website itself. Its job is to understand Foam semantics and emit clean outputs for a site layer such as Astro plus Starlight.

In shorthand:

`Foam workspace -> foam-publish -> Markdown + JSON + assets -> site builder`

## Why This Package Exists

The website framework is not the hard part of publishing Foam. The hard part is preserving Foam semantics on the web:

- wikilinks
- aliases
- headings and block anchors
- note embeds
- backlinks
- graph relationships
- publish visibility rules
- `foam-query` blocks where safe

If those concerns are pushed into the site layer, Foam becomes tightly coupled to one renderer. `foam-publish` exists to keep that logic owned by Foam and reusable across targets.

## Responsibilities

`foam-publish` should do five things:

1. Load a Foam workspace and build the content model
2. Decide which notes and assets are publishable
3. Transform Foam-specific syntax into web-ready content
4. Derive metadata needed by published sites
5. Emit a clean artifact set for a renderer or static-site framework

## Non-Responsibilities

`foam-publish` should not own:

- page layout
- theming and site styling
- search UI
- graph visualization rendering
- SEO chrome
- deployment-specific product UX

Those belong in the site package.

## Relationship to Existing Foam Code

The long-term dependency should be a proper extracted `foam-core` package.

In the current repository shape, the nearest reusable foundation lives under:

- [foam.ts](../../../packages/foam-vscode/src/core/model/foam.ts)
- [workspace.ts](../../../packages/foam-vscode/src/core/model/workspace.ts)
- [markdown-parser.ts](../../../packages/foam-vscode/src/core/services/markdown-parser.ts)

That means the first iteration of `foam-publish` will likely require some extraction work so that publish logic does not depend on VS Code-specific modules.

## Package Location

The implementation should start at:

- `packages/foam-vscode/src/publish`

Once the API and boundaries are stable, it should be extracted to:

- `packages/foam-publish`

This is a pragmatic sequencing choice, not a change in architecture. The code should be written from day one as if extraction were expected.

That means:

- no `vscode` imports in `src/publish/**`
- imports from `src/core/**` are allowed
- the publishing layer should expose a clean entrypoint
- internal folders should already mirror the eventual standalone package structure

## Public API

The publishing layer should expose a small programmatic API and a thin CLI.

Suggested primary API:

```typescript
export interface PublishConfig {
  workspaceRoot: string;
  outDir: string;
  baseUrl?: string;
  target: 'generic-static' | 'astro-starlight';
  clean?: boolean;
  visibility?: {
    mode: 'public-by-default' | 'private-by-default' | 'folder-based';
    publicGlobs?: string[];
    privateGlobs?: string[];
  };
  features?: {
    backlinks?: boolean;
    graph?: boolean;
    searchIndex?: boolean;
    noteEmbeds?: boolean;
    foamQuery?: 'off' | 'safe-only';
  };
}

export interface PublishArtifactSet {
  notes: PublishedNote[];
  assets: PublishedAsset[];
  routes: PublishedRoute[];
  graph?: unknown;
  searchIndex?: unknown;
  nav?: unknown;
}

export async function buildSite(
  config: PublishConfig
): Promise<PublishArtifactSet>;
```

The API should favor inspectable outputs over opaque HTML blobs.

## CLI Shape

The CLI should stay thin and call the publishing API.

Suggested commands:

```bash
foam publish build
foam publish build --target astro-starlight
foam publish watch
foam publish export --out-dir .foam-publish
```

Whether these commands land in an existing Foam CLI package or a new CLI wrapper is a separate packaging decision. The important part is to keep the core publishing logic in the publishing module rather than spreading it across CLI code.

## Expected Usage

The logical API should look like this. During the initial in-repo phase, it would be exported from `packages/foam-vscode/src/publish`. After extraction, the same API can become the public surface of `packages/foam-publish`.

```typescript
import { buildSite } from './publish';

await buildSite({
  workspaceRoot: '/notes/my-foam',
  outDir: '/notes/my-foam/.foam-publish',
  target: 'astro-starlight',
  visibility: {
    mode: 'folder-based',
    publicGlobs: ['docs/**', 'garden/**'],
  },
  features: {
    backlinks: true,
    graph: true,
    searchIndex: true,
    noteEmbeds: true,
    foamQuery: 'safe-only',
  },
});
```

This should produce a publishable intermediate output that a site package can consume directly.

## Output Shape

For an Astro plus Starlight target, the emitted output should be inspectable and structured.

Example:

```text
.foam-publish/
  content/
    note-a.md
    projects/note-b.md
  assets/
    image.png
    pdfs/paper.pdf
  data/
    graph.json
    backlinks.json
    search-index.json
    routes.json
    nav.json
```

This keeps the publishing output debuggable and lets the site layer focus on rendering instead of resolution.

## Internal Module Structure

The initial in-repo structure should be:

```text
packages/foam-vscode/
  src/
    publish/
      index.ts
      config.ts
      types.ts

      bootstrap/
        create-context.ts
        load-workspace.ts

      collect/
        collect-notes.ts
        collect-assets.ts
        collect-routes.ts

      filters/
        apply-publish-rules.ts
        should-publish-note.ts
        should-publish-asset.ts

      transform/
        transform-note.ts
        rewrite-links.ts
        resolve-wikilinks.ts
        resolve-anchors.ts
        render-embeds.ts
        render-queries.ts
        materialize-backlinks.ts
        normalize-frontmatter.ts

      derive/
        build-search-index.ts
        build-graph-data.ts
        build-nav-tree.ts
        build-backlink-index.ts
        build-route-manifest.ts

      emit/
        emit-markdown.ts
        emit-json.ts
        emit-assets.ts
        write-output.ts

      targets/
        generic-static.ts
        astro-starlight.ts

      cli/
        build.ts
        watch.ts
```

Once extracted, the structure should map almost directly to:

```text
packages/foam-publish/
  src/
    index.ts
    config.ts
    types.ts

    bootstrap/
      create-context.ts
      load-workspace.ts

    collect/
      collect-notes.ts
      collect-assets.ts
      collect-routes.ts

    filters/
      apply-publish-rules.ts
      should-publish-note.ts
      should-publish-asset.ts

    transform/
      transform-note.ts
      rewrite-links.ts
      resolve-wikilinks.ts
      resolve-anchors.ts
      render-embeds.ts
      render-queries.ts
      materialize-backlinks.ts
      normalize-frontmatter.ts

    derive/
      build-search-index.ts
      build-graph-data.ts
      build-nav-tree.ts
      build-backlink-index.ts
      build-route-manifest.ts

    emit/
      emit-markdown.ts
      emit-json.ts
      emit-assets.ts
      write-output.ts

    targets/
      generic-static.ts
      astro-starlight.ts

    cli/
      build.ts
      watch.ts
```

This structure separates the actual content work from the target-specific output details.

## What Each Layer Does

### `bootstrap/`

Loads the workspace and constructs the Foam model needed by the publishing pipeline.

Responsibilities:

- create the publish context
- load the workspace roots
- build or reuse workspace, graph, and parser services

This layer must remain independent of VS Code APIs.

### `collect/`

Finds the candidate notes and assets that might be published.

Responsibilities:

- enumerate notes
- enumerate attachments
- propose canonical routes

This stage does not decide final visibility yet. It gathers the raw candidates.

### `filters/`

Applies visibility and publish rules.

Responsibilities:

- drop private notes
- drop private assets
- enforce folder-based or frontmatter-based rules

The output of this stage is the actual publish set.

### `transform/`

This is the heart of the package. It turns Foam semantics into site-ready content.

Responsibilities:

- resolve `[[wikilinks]]` into canonical routes
- preserve alias labels
- resolve section links and block references
- rewrite relative links and attachment paths
- render note embeds where supported
- precompute backlinks
- normalize frontmatter for site consumption
- render `foam-query` blocks where safe

The website should not be responsible for understanding how Foam link resolution works. That belongs here.

### `derive/`

Builds metadata that the site can consume.

Responsibilities:

- graph JSON
- route manifest
- backlink index
- navigation tree
- search index

This is where the published site gets the data needed for graph view, backlinks, and navigation helpers.

### `emit/`

Writes the final artifact set.

Responsibilities:

- write transformed Markdown
- write JSON data files
- copy assets
- manage output directory layout

This layer should be intentionally dumb. It writes already-prepared data.

### `targets/`

Defines small target-specific policies without owning Foam semantics.

Responsibilities:

- map output into an Astro plus Starlight-friendly shape
- allow a generic static target with fewer assumptions

Target adapters should stay thin. They should not reimplement transformation logic.

## Pipeline

The build pipeline should read naturally:

1. Create a publish context
2. Collect candidate notes and assets
3. Apply publish rules
4. Transform notes
5. Derive metadata
6. Emit output

In pseudocode:

```typescript
const ctx = await createPublishContext(config);
const candidates = await collectPublishableResources(ctx);
const filtered = applyPublishRules(candidates, ctx);
const notes = await transformNotes(filtered.notes, ctx);
const derived = await deriveArtifacts(notes, filtered.assets, ctx);
await emitArtifacts(notes, derived, ctx);
```

Each stage should be testable in isolation.

## Feature Ownership

Specific feature boundaries should be explicit.

### Link Rewriting

`rewrite-links.ts` should:

- convert Foam links to site routes
- preserve alias labels
- rewrite attachment paths

### Anchors

`resolve-anchors.ts` should:

- assign stable heading IDs
- emit stable block IDs
- make section and block links deterministic in output

### Embeds

`render-embeds.ts` should:

- resolve note embeds at build time where possible
- preserve attachment embeds
- detect cycles and fail clearly

### Queries

`render-queries.ts` should:

- support deterministic build-time query rendering first
- likely support declarative queries before any JS-powered queries
- fail clearly when a query is unsupported for publishing

### Backlinks

`materialize-backlinks.ts` should:

- compute backlinks from the Foam graph
- attach backlink metadata to published pages or data files

## First Practical Scope

The first implementation should stay narrow.

Suggested v1:

1. Load workspace
2. Filter publishable notes
3. Rewrite wikilinks and attachment paths
4. Emit transformed Markdown
5. Emit route manifest and backlink JSON

That is enough to prove the architecture without prematurely building graph UI, advanced embed rendering, or full query support.

## Extraction Work Expected Up Front

Before the publishing layer can be clean, some code will likely need to move out of VS Code-oriented areas into framework-agnostic utilities.

Likely candidates:

- shared parsing helpers
- route and link rewriting logic
- block-anchor generation logic
- embed-resolution logic that does not depend on the preview renderer

The first implementation should prefer extraction over duplication.

## Site Package Contract

The companion site package should consume `foam-publish` output, not raw workspace notes.

That means the site package can remain thin:

- read emitted Markdown
- read JSON indexes
- render pages and navigation
- add graph, backlink, and preview components

This keeps the website replaceable without changing the publishing core.

## Open Decisions

- Should publish rules live in frontmatter, settings, folder conventions, or a combination?
- Should the first output be written into an intermediate directory or directly into a site workspace?
- How much of the current preview pipeline can be extracted unchanged?
- Should `foam-query-js` be explicitly unsupported for published builds in v1?

## Proposed Next Step

After agreeing on this plan, the next implementation task should be a small scaffold under `packages/foam-vscode/src/publish` plus an extraction pass for the minimum reusable core needed by v1.

The extraction to `packages/foam-publish` should happen only after the API and internal boundaries have proven stable.
