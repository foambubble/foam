# CLAUDE.md

Guidance for Claude Code working in this repository.

## How we work together

**Be honest and objective.** Evaluate suggestions on their technical merits. Don't be complimentary by reflex. If something doesn't make sense or could be better, say so directly. Challenge my assumptions — that's more useful to me than agreement.

**Build the smallest thing that covers today's behavior.** Don't add UI affordances I didn't ask for. Don't parameterize or scope for cases the runtime never exercises (per-workspace state in a single-workspace extension, per-folder watchers with an identical glob). Don't add machinery for hypothetical futures. If you think generality will be needed later, say so and leave it out — we can add it when something actually requires it.

**Verify before you recommend, not just before you implement.** "We should add X" is a claim about the current code. Go read the code first: grep for the thing, check whether it already exists, confirm the bug is real. This applies to analysis and recommendations, not only to features.

**Plan before code on anything non-trivial.** Propose the approach and save it to `.agent/current-plan.md` before making changes; keep it updated as work progresses. I want to see the plan itself, not a narration of you producing one. For issues, check whether `.agent/tasks/<issue-id>-<sanitized-title>.md` exists — if not, suggest `/research-issue <issue-id>`.

**Answer the question I asked.** If I'm asking rather than instructing, answer it and stop. Don't start editing because a question implies work.

**Keep output short.** Terminal output and files you write for me both. No preamble, no restating what you just did, no summary table of a three-line change. Same standard as the user docs below: every sentence must earn its place.

**Prefer doing over delegating.** The test suite runs as one command and the codebase is small enough to read. Spawn subagents only when the work genuinely fans out across independent areas.

**Never lose existing content.** Through rewrites, reverts, or unrelated changes — if you're replacing a document or backing something out, preserve what was there and confirm what you dropped.

**Ask before any GitHub write.** Issues, PRs, comments, pushes. Read operations are fine.

## Environment

Yarn v1 workspaces + Lerna. Node via plain `nvm use` from the repo root — don't source `nvm.sh`, export `NVM_DIR`, or pin a version.

**Prefer simple commands.** Each compound/chained/piped command may need manual approval, which breaks autonomous runs. Default to single-purpose commands matching the existing allowlist. Don't wrap things in `bash -c`, `eval`, or defensive `|| true`. Compound is fine where genuinely needed: atomic operations (`git add X && git commit`), pipes that are the interface (`find | xargs`, `cmd | jq`), heredocs, and loops over many items.

**Working outside the main checkout.** The Bash tool's CWD is always the main checkout, not wherever you last `cd`'d. To avoid a prompt per call:

- `git -C <path> <subcommand>` for git
- For yarn, in order of preference: `yarn workspace <package> <cmd>`, `yarn --cwd <path> <cmd>`, `cd <path> && yarn <cmd>`
- `cd <path> && npm <cmd>` for npm
- Don't mix `git -C` with `cd &&` in one command
- Introducing a new shape (`cd && python`, `cd && cargo`)? Add it to `.claude/settings.local.json` first

## Commands

From `packages/foam-vscode`:

|                                            |                                                             |
| ------------------------------------------ | ----------------------------------------------------------- |
| `yarn build` / `yarn watch` / `yarn clean` | build                                                       |
| `yarn reset`                               | clean, install, build                                       |
| `yarn test:unit`                           | `*.test.ts` + `@unit-ready` specs — **use this by default** |
| `yarn test:e2e`                            | all `*.spec.ts` in a real VS Code host                      |
| `yarn test`                                | both                                                        |
| `yarn lint`                                | lint                                                        |
| `yarn test-reset-workspace`                | clean test workspace                                        |

The runner ignores extra arguments — you cannot run a single test, only the whole suite.

Graph webview: `yarn workspace @foam/graph-view build` (also `build:vscode`, `watch`, `test`).

## Testing

**Fixing a bug — including PR review comments — starts with a failing test.** Write the test (include the issue number if present), run the suite, confirm it fails for the right reason, then implement the fix. Never write fix and test together.

**Never fix a test by weakening a correct expectation.** If the expectation is right, the code is wrong.

`*.test.ts` are unit tests (Vitest, Node). `*.spec.ts` are integration tests needing the VS Code extension host. Both live alongside the code in `src/`. A test is integration if it depends on `vscode`, directly or transitively. A `*.spec.ts` starting with `/* @unit-ready */` can run against the mock `vscode` module — those run in both `test:unit` and `test:e2e`, intentionally.

- Keep mocking minimal. Never mock anything in `packages/foam-core`. Write code that's testable without mocks; use real I/O in temp directories when needed.
- Use the helpers in `test-utils.ts`, `test-utils-vscode.ts`, `test-datastore.ts`.
- Set up and tear down inside the test case rather than `beforeEach`, unless that's genuinely clearer.
- Name test cases after the behavior being verified — they document expected behavior. Cover happy paths and edge cases.
- When several tests fail, read them all, then fix only the first. Re-run and repeat.

## Conventions with teeth

**`packages/foam-core` is the platform-agnostic core.** No `vscode` import. No Node `path` — it runs in browser and React Native too, so use the POSIX-safe helpers in `src/utils/path.ts` (`relativeTo`, `joinPath`, `getBasename`, `getExtension`, `getDirectory`). vm-dependent scripting exports (`TemplateLoader`, `resolveDailyNote`, `noteCreate`, `renderJsQuery`) live behind the `@foam/core/scripting` subpath to keep the main barrel bundler-safe.

`packages/foam-vscode/src/core/` is a legacy shim holding only `model/foam.ts` (extends core's `Foam` with `embeddings`). Don't add to it.

**A `@foam/core` change needs a changeset that also lists `foam-vscode` and `@foam/cli`** (usually `patch`). They bundle core at build time via esbuild and declare it a `devDependency`, so Changesets won't cascade the bump — without this their republished bundles ship new code under a stale version with no changelog. See `docs/dev/releasing-foam.md`.

**URIs throughout, paths only at the edges.** Domain code takes and returns `URI`, not path strings — consistent with `FoamWorkspace.find(uri)`, `FoamGraph.getLinks(uri)`, `Resource.uri`.

```typescript
function listOrphans(workspace, graph, rootUri: URI): NoteItem[]; // ✅
function listOrphans(workspace, graph, rootDir: string): NoteItem[]; // ❌
```

Path strings appear only at I/O boundaries (`IDataStore` converting URI ↔ fs path), external wire formats (CLI args, MCP inputs, JSON), and human-readable display fields alongside the URI.

**Use the project's vocabulary.** "Workspace", never "vault" (that's Obsidian's term). Avoid "gated" framing for access levels — prefer "accessible to X". Name a method after what it wraps rather than inventing a new term.

**Put files in their proper home.** Test-only fixtures in a test folder. Generated artifacts in build output — gitignoring them inside source isn't enough. Deliverables in the project, not `/tmp`. `.agent/` specs only in the main checkout.

Prefer pure functions where practical. Reuse existing helpers and constants instead of adding parallel ones.

## Non-obvious architecture

Monorepo: `packages/{foam-core,foam-vscode,foam-graph,foam-cli,foam-mcp}`.

Things you won't infer quickly from reading:

- **FoamWorkspace** uses a reversed trie for resource lookup, which is what makes short-form identifier resolution work.
- **FoamGraph** creates placeholder resources for broken links — they're real graph nodes, not absences.
- **ResourceProvider** is the extension point per file type (`MarkdownProvider`, `AttachmentProvider`).
- **Features** are registered as `(context: ExtensionContext, foamPromise: Promise<Foam>) => void` in `packages/foam-vscode/src/vscode/features/index.ts`.
- **The graph webview** is a Lit web component in `packages/foam-graph/`. `packages/foam-vscode/static/dataviz/` is gitignored build output, not source. `src/protocol.ts` owns the extension↔webview message contract. The extension resolves `@foam/graph-view/*` via the package `exports` map for typechecking; esbuild resolves the same way at bundle time.
- **`foam-extension-test-host.ts`** does not activate AI features — the mock Foam has no embeddings.

## User documentation (`docs/user/`)

Written for people new to Foam who may not be technical. Show how to use a feature, not how it works internally. Lead with the most common use case, use concrete examples, and keep it short — users won't read verbose docs, and every sentence must convey something new.

## Pointers

- Extension settings (`foam.*` namespace): `packages/foam-vscode/package.json`
- Release process: `docs/dev/releasing-foam.md`
- GitHub: use `gh`. Reads freely; **ask before any write**.
