---
title: "Improved Static Site Generation"
description: "Published from /Users/riccardo/.codex/worktrees/a57a/foam/docs/dev/proposals/improved-static-site-generation.md"
---
# Improved Static Site Generation

## Summary

Foam should adopt a two-layer publishing architecture:

- a Foam-owned publishing layer in TypeScript that understands Foam semantics
- a modern static site shell, with Astro and Starlight as the default implementation

This keeps Foam aligned with the project's build-vs-assemble principle while still giving users a polished website for browsing their knowledge base.

## Problem

Today, Foam has publishing documentation and community templates, but not a single modern architecture that:

- preserves Foam semantics reliably
- produces a high-quality static site
- gives the project a durable TypeScript integration point
- remains optional instead of locking Foam to one publishing target

If Foam only chooses a website framework, the framework ends up becoming the architecture. That is too brittle. Foam needs a publishing pipeline of its own.

## Goals

- Publish a Foam knowledge base as a static website
- Preserve Foam-specific semantics where possible:
  - wikilinks
  - aliases
  - block anchors and section links
  - embeds
  - tags
  - backlinks
  - graph metadata
  - publish visibility rules
  - `foam-query` blocks, at least where they can be resolved safely at build time
- Reuse Foam parsing and graph logic
- Keep the publishing path framework-agnostic enough to support other site targets later
- Make the default user experience modern and visually strong

## Non-Goals

- Building a bespoke all-in-one site generator as the first step
- Replacing ordinary Markdown authoring with a new required syntax
- Requiring VS Code APIs during website generation
- Solving every interactive publishing feature in the first iteration

## Recommended Stack

### Default Site Stack

- Framework: Astro
- Site shell: Starlight
- Content input: generated Markdown plus derived JSON metadata
- Optional richer authored pages: Markdoc or MDX where needed

### Why This Stack

Astro and Starlight provide the polished site quickly. Foam's own publishing layer protects the project from tying note semantics directly to any one site framework.

This means Foam can:

- ship a good default website
- keep the core publishing logic in TypeScript
- preserve the option to support other renderers later

## Proposed Architecture

## 1. Foam Publishing Layer

Add a publishing layer responsible for turning a Foam workspace into publishable artifacts.

The logical module should not depend on VS Code. It should consume Foam core models and services.

For implementation, this should be phased:

- first iteration: `packages/foam-vscode/src/publish`
- later extraction: `packages/foam-publish`

The first iteration should be written as if it were already an extractable package. That means keeping it framework-agnostic, avoiding `vscode` imports, and giving it a clean entrypoint and module structure.

Suggested responsibilities:

- discover and load publishable notes from a workspace
- resolve wikilinks, aliases, and anchors using Foam's own workspace and graph logic
- evaluate publish visibility rules
- rewrite links for the target site
- expand or rewrite embeds
- compute backlinks
- compute graph/search metadata
- render or precompute `foam-query` output when possible
- emit a normalized set of output files for a site framework

Suggested inputs:

- workspace root
- publish target configuration
- output mode and path

Suggested outputs:

- transformed Markdown files for each published note
- JSON indexes for search, backlinks, graph, and route metadata
- copied static assets and attachments

## 2. `packages/foam-site-starlight`

Add a site package or starter that consumes the output of `foam-publish`.

Responsibilities:

- render the transformed notes as a polished website
- provide navigation, layout, SEO, and search UI
- add Foam-specific components such as backlinks, graph views, and hover previews
- expose theming and site-level customization

This package should stay thin. It is an implementation of the publishing output, not the source of truth for Foam semantics.

## 3. CLI and Automation

Expose the pipeline through a CLI entry point, likely via Foam CLI or a dedicated command.

Examples:

- build a local static site
- watch and rebuild during development
- emit publishable artifacts for GitHub Pages, Vercel, or Netlify

This matches the existing direction in the repository toward build-time transformations and automation.

## Data Flow

The first version should follow this pipeline:

1. Read the Foam workspace using core services
2. Filter notes according to publish rules
3. Parse notes and resolve Foam constructs
4. Emit transformed Markdown for the site
5. Emit derived JSON indexes
6. Let Astro and Starlight build the final static HTML

In shorthand:

`Foam workspace -> foam-publish -> Markdown + JSON -> Astro/Starlight -> static HTML`

## Why Generated Markdown Plus JSON

This is the most practical first output format.

Advantages:

- It keeps the content inspectable and portable
- It works naturally with Starlight and Astro content collections
- It avoids forcing the site layer to reimplement Foam parsing logic
- It gives the site enough structured metadata for backlinks, graph views, and search-related UI

Generating only HTML would make customization harder. Generating only a raw graph JSON model would push too much work into the site layer. Markdown plus derived JSON is the right balance.

## Treatment of Foam Features

## Wikilinks and Aliases

Resolve them at build time to stable site routes. The site should not need to guess how Foam resolution works.

## Block Anchors and Section Links

Emit stable heading and block IDs during transformation so links and popovers can target exact content.

## Embeds

Handle note embeds at build time where possible. Preserve attachment embeds and image references as normal site assets.

## Backlinks

Compute backlinks in `foam-publish` and expose them as page metadata or a site-wide index.

## Graph View

Emit graph data as JSON derived from Foam's own graph model. Render it in the site layer with a dedicated component.

## `foam-query`

Treat query blocks as build-time features when safe and deterministic. Where execution is unsafe or unsupported, fail clearly and leave a readable placeholder in output.

## Publish Visibility Rules

Implement this in `foam-publish`, not in the site layer. The site should only receive already-filtered content.

## Why Not Make Markdoc the Core

Markdoc is a good integration option, but not a good center of gravity for the first version.

Reasons:

- Foam notes should stay ordinary Markdown first
- Foam already has its own semantics to preserve
- switching the base representation to Markdoc would increase coupling and reduce portability

Markdoc is still useful for richer authored documentation pages outside the imported note corpus.

## Why Not Start With Quartz

Quartz is close enough to Foam that it is worth studying and possibly spiking against. However, starting directly from Quartz would blur the boundary between Foam semantics and site implementation.

The project should instead:

- borrow feature ideas from Quartz
- compare experience against Quartz during prototyping
- keep Foam's publishing logic separate from the chosen renderer

## Incremental Delivery Plan

### Phase 0: Internal Publish Spike

- Implement the publishing layer in `packages/foam-vscode/src/publish`
- Reuse existing Foam core and parser code where possible
- Keep the module free of `vscode` imports
- Prove the basic API and output shape before extracting a standalone package

### Phase 1: Minimal Viable Site

- Publish filtered notes as routed pages
- Rewrite wikilinks and attachments
- Generate navigation from folders and titles
- Support search through the default Starlight capabilities or a simple generated index

### Phase 2: Foam Semantics

- Add backlinks
- Add block anchors and section-deep links
- Add note embeds
- Add publish rules

### Phase 3: Knowledge-Base Experience

- Add graph view
- Add hover previews
- Add richer query rendering
- Add deployment presets and starter templates

## Open Questions

- What exact publish-rule syntax should Foam support: public-by-default, private-by-default, or folder-based publishing?
- Should `foam-query-js` be supported in published output at all, or only the declarative query language?
- Should the first version generate files directly into a site workspace, or into an intermediate output folder consumed by the site package?
- How much of the existing preview pipeline can be shared directly, and how much should move into framework-agnostic publish utilities?

## Proposed Decision

Adopt Astro plus Starlight as the default website stack, and implement a framework-agnostic Foam publishing layer that emits transformed Markdown and derived JSON for the site to render.

Start that implementation in `packages/foam-vscode/src/publish`, then extract it to `packages/foam-publish` once the API and boundaries have stabilized.

That gives Foam the right default without collapsing publishing strategy into a single website framework.


## Backlinks

- [Roadmap](/dev/proposals/roadmap)
