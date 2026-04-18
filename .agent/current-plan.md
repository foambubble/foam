# Current Plan

## Goal

Build a minimal end-to-end static-site spike that proves the current publishing slice can drive a navigable site.

## Steps

- [completed] Update the plan for the end-to-end site spike
- [completed] Inspect the repo for existing site/web scaffolding and choose the spike location
- [completed] Scaffold a minimal Astro/Starlight site consumer
- [completed] Wire the current publish output into the site build path
- [completed] Run the site locally and verify basic navigation

## Current Publish Slice

- `buildSite` builds a minimal publish artifact set from a `FoamWorkspace`
- note routes are derived for published notes
- note markdown is rewritten from Foam links to publishable markdown links
- linked attachments are mapped to asset output paths
- backlinks are derived from `FoamGraph`

## End-to-End Spike Scope

- create a thin Astro/Starlight consumer under `packages/`
- generate site content from the current publish output
- prove that rewritten note links and asset links work in a browser
- defer publish filtering and richer metadata until after the spike works

## Current Spike Result

- `packages/foam-site-starlight` exists as a minimal Starlight consumer
- generation runs from source via `node --import tsx ./scripts/generate-docs.ts`
- the current publish slice generates 89 docs pages from `docs/`
- the site serves locally at `http://127.0.0.1:4321/` when started with Node 22
- basic navigation was verified by fetching the homepage and a deeper route
- the spike still uses generator-level asset rewriting and copying for ordinary markdown image paths
- Starlight root-level sidebar autogeneration works best when left to the default config; a custom `autogenerate.directory: '.'` group renders empty in this version
- the Starlight consumer should keep only source/config in git and treat `.astro`, generated docs content, copied assets, and route manifests as build artifacts
- the Starlight consumer now ignores generated docs content, copied assets, route manifests, and Astro internals via `packages/foam-site-starlight/.gitignore`
- the Starlight adapter now skips Foam's `/404` route so the framework can own not-found handling

## Notes

- Keep the recommendation aligned with Foam's "build vs assemble" principle.
- Prefer a TypeScript publishing layer that preserves Foam semantics while keeping the site framework optional.
- Test strategy:
  - Favor unit tests first for pure build-time logic in `src/publish`.
  - Test the pipeline in slices: route generation, publish filtering, backlink derivation, output manifest generation, and representative note transforms.
  - Use real-ish workspace fixtures and existing test utilities instead of mocking `src/core`.
  - Keep setup and teardown inside each test unless sharing clearly improves readability.
  - During implementation, run `yarn test:unit`; before closing the slice, run the relevant unit suite again and `yarn lint` if the surface expands.
- Execution guardrails:
  - Keep v1 narrow: load workspace, filter notes, rewrite wikilinks and attachments, emit transformed markdown, emit route/backlink metadata.
  - Keep `src/publish/**` free of `vscode` imports.
  - Reuse `src/core/**` rather than duplicating resolution logic.
  - Stop and refactor if tests start needing heavy mocking or the module begins depending on renderer concerns.
- Verification:
  - `yarn workspace foam-site-starlight generate` passes after the cleanup.
  - `node /Users/riccardo/.nvm/versions/node/v22.17.0/bin/node /Users/riccardo/.nvm/versions/node/v20.11.1/lib/node_modules/yarn/lib/cli.js workspace foam-site-starlight build` passes.
