# Current Plan

## Goal

Add a single-package CLI entry to `packages/foam-vscode` and use it to drive the existing publish pipeline, starting with `foam publish --target starlight`.

## Steps

- [completed] Confirm the single-package CLI direction and rebase the branch onto `main`
- [completed] Research existing workspace-loading and build patterns to reuse for a Node CLI
- [completed] Add CLI entrypoints and a first `publish` command under `src/cli`
- [completed] Extend the build to emit a CLI artifact and expose package scripts
- [completed] Verify unit coverage and run an end-to-end CLI publish flow
- [completed] Research how Foam docs are currently published and define the clean interface point for merging this branch
- [completed] Add merge-readiness follow-ups for docs integration, starting with CI smoke coverage rather than switching deployment

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
- runnable Starlight project materialization now lives in `packages/foam-vscode/src/publish/targets/starlight`
- the target writes project scaffold files (`package.json`, `astro.config.mjs`, `tsconfig.json`, `src/content.config.ts`) alongside generated docs, assets, and manifests
- `packages/foam-site-starlight` is now only a thin harness that builds a workspace and calls the Starlight target in content-only mode
- the next slice should move execution into a CLI inside `packages/foam-vscode`, so the Starlight harness becomes optional and later removable
- a first CLI now exists under `packages/foam-vscode/src/cli`, with a `publish` command that loads a workspace and materializes the `starlight` target
- the package build now emits a CLI artifact at `packages/foam-vscode/out/cli/index.js`
- the Starlight harness package can now be removed; the CLI path is the product path
- `packages/foam-site-starlight` has been removed; the supported path is now `yarn workspace foam-vscode publish-site ...`

## Notes

- Keep the recommendation aligned with Foam's "build vs assemble" principle.
- Prefer a TypeScript publishing layer that preserves Foam semantics while keeping the site framework optional.
- Keep publish work API-first: define stable publish semantics and typed outputs in `src/publish` before adding renderer-specific behavior or configuration surfaces.
- Treat a publish target as a runnable output, not just transformed content. For `starlight`, `foam publish` should be able to materialize a Starlight-ready project in the target directory, with generated content plus the minimal app/package setup required to install and run it there.
- Make publish configuration fully programmable in code: any supported behavior should be easy to express directly through the `src/publish` API, with YAML/query-style forms treated as convenience layers over that API.
- Keep the CLI in the same package as the extension, but maintain code boundaries: `src/cli/**` may depend on CLI-safe modules (`src/core/**`, `src/publish/**`) and must not depend on `vscode` or extension feature code.
- Favor one CLI executable with subcommands over separate bins per command.
- Keep CLI argument parsing lightweight in v1 unless complexity actually justifies a parser dependency.
- For Foam's own docs, treat `docs/` as publish source content and the generated site as a disposable build artifact. Do not move the site scaffold into the repo tree or couple merge readiness to a deployment switch.
- Keep the existing `foam-template` sync workflow separate from docs-site publication. That workflow distributes source docs, not the rendered website.
- Before switching Foam's public docs to the new path, add CI smoke coverage that exercises `foam publish` against `./docs` so the branch can merge without taking ownership of Pages deployment yet.
- Prefer a repo-root dogfood command for Foam's own docs so CI and humans use the same entrypoint instead of depending on the workspace-local script cwd.
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
  - `yarn test:unit` passes in `packages/foam-vscode`.
  - `yarn lint` passes in `packages/foam-vscode` with the existing skipped-test warning in `src/vscode/features/notes/connections.spec.ts`.
  - `yarn build:cli` passes in `packages/foam-vscode`.
  - `node packages/foam-vscode/out/cli/index.js publish ./docs --out ./.tmp/<site>` materializes a runnable Starlight site.
  - `yarn publish:docs-site` passes from the repo root and materializes Foam's docs site from `./docs`.
  - `astro build` succeeds from the CLI-generated site output when run against the repo-installed dependencies.
  - `yarn publish-site ./docs --out ./.tmp/<site>` succeeds from `packages/foam-vscode` after the Starlight package removal.
