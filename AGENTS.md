# AGENTS.md

Guidance for coding agents working in this repository — Claude Code, Codex, Cursor, Copilot, or anything else that reads this file. The same rules apply to humans; [CONTRIBUTING.md](CONTRIBUTING.md) covers setup and the PR flow.

## How to work

**Build the smallest thing that covers today's behavior.** Don't add UI affordances nobody asked for. Don't parameterize or scope for cases the runtime never exercises (per-workspace state in a single-workspace extension, per-folder watchers with an identical glob). Don't add machinery for hypothetical futures. If you think generality will be needed later, say so and leave it out — it can be added when something actually requires it.

**Verify before you recommend, not just before you implement.** "We should add X" is a claim about the current code. Read the code first: grep for the thing, check whether it already exists, confirm the bug is real. This applies to analysis and recommendations, not only to features.

**Plan before code on anything non-trivial.** Write the approach to `.agent/current-plan.md` (gitignored) before changing anything and keep it updated as work progresses. Show the plan itself, not a narration of producing it.

**Answer the question that was asked.** If the contributor is asking rather than instructing, answer and stop. Don't start editing because a question implies work.

**Be honest and objective.** Evaluate suggestions on their technical merits. Don't be complimentary by reflex. If something doesn't make sense or could be better, say so directly and challenge the assumption — that's more useful than agreement.

**Keep output short.** Terminal output and files alike. No preamble, no restating what you just did, no summary table for a three-line change. Every sentence must earn its place.

**Prefer doing over delegating.** The test suite runs as one command and the codebase is small enough to read. Spawn subagents only when the work genuinely fans out across independent areas.

**Never lose existing content.** Through rewrites, reverts, or unrelated changes — if you're replacing a document or backing something out, preserve what was there and say what you dropped.

**Nothing leaves the machine unless the contributor says so.** No pushes, PRs, issues, comments, or releases unless explicitly asked for in that same exchange. Cut branches from `origin/main` (fetch first — a local `main` may carry unpushed work), commit locally, and hand over a ready-to-paste PR title and description. Reading GitHub with `gh` is fine.

## Specs

Work that warrants acceptance criteria before code gets a spec in `specs/<slug>/`. `spec.md` is what and why and is reviewer-visible; `plan.md` is how, and a code reviewer must not read it — a reviewer who knows the intended approach checks the code against the plan instead of checking whether it's right. `specs.local/` is the same layout, gitignored, for exploration that hasn't graduated.

`<slug>` is the branch name minus its type prefix (`feature/`, `fix/`, `spike/`), so the active spec is the one matching the current branch. One branch and one PR carry a feature from spec to merge; stages are started by adding an `agent:<stage>` label to the issue or PR, and steered with `@claude` comments. Not everything needs a spec — a bug whose failing test says it all doesn't. See [specs/README.md](specs/README.md) for the layout and the acceptance-criteria format.

**Writing one is a procedure, not a blank page**: [.claude/skills/write-spec/SKILL.md](.claude/skills/write-spec/SKILL.md) has it — classify the work, research before claiming, keep solutions out of the spec, be honest about how each criterion gets verified. Read it whichever agent you are; Claude Code loads it as `/write-spec`.

## Environment

Yarn v1 workspaces + Lerna. Node 22 (`.nvmrc`): `nvm use` from the repo root is enough — don't source `nvm.sh`, export `NVM_DIR`, or pin another version. Run `yarn` then `yarn build` from the root before anything else.

**Prefer simple commands.** Compound, chained, or piped commands often need manual approval, which breaks autonomous runs. Default to one single-purpose command per call. Don't wrap things in `bash -c` or `eval`, and don't add defensive `|| true` or `2>/dev/null` unless an expected failure is actually being handled. Don't staple extra steps onto a request (no `git log` after a requested `git status`). Compound is fine where genuinely needed: atomic operations (`git add X && git commit`), pipes that are the interface (`find | xargs`, `cmd | jq`), heredocs, and loops over many items.

## Commands

From the repo root, each runs across every package via Lerna: `yarn build`, `yarn watch`, `yarn clean`, `yarn reset` (clean, install, build), `yarn test:unit`, `yarn test:e2e`, `yarn test`, `yarn lint`, `yarn bench`, `yarn format`.

Per package: `yarn workspace <name> <script>`, where `<name>` is `@foam/core`, `foam-vscode`, `@foam/cli`, `@foam/graph-view`, or `@foam/mcp`.

In `foam-vscode`:

|                             |                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------- |
| `yarn test:unit`            | `*.test.ts` + `@unit-ready` specs against the mock `vscode` — **use this by default** |
| `yarn test:e2e`             | all `*.spec.ts` in a real VS Code host (slow)                                         |
| `yarn test-reset-workspace` | clean the test workspace                                                              |

The runner ignores extra arguments — you cannot run a single test, only the whole suite.

Lint is oxlint (`yarn lint`; the pre-push hook runs it too). Formatting is Prettier with the config in the root `package.json`.

## Testing

**Fixing a bug — including addressing a PR review comment — starts with a failing test.** Write the test (name the issue number if there is one), run the suite, confirm it fails for the right reason, then implement the fix. Never write fix and test together.

**Never fix a test by weakening a correct expectation.** If the expectation is right, the code is wrong.

`*.test.ts` are unit tests (Vitest, Node). `*.spec.ts` are integration tests needing the VS Code extension host. Both live alongside the code in `src/`. A test is integration if it depends on `vscode`, directly or transitively. A `*.spec.ts` starting with `/* @unit-ready */` can run against the mock `vscode` module — those run in both `test:unit` and `test:e2e`, intentionally. Details in `docs/dev/testing-conventions.md`.

- When a feature has a domain layer and a VS Code adapter, domain behavior (what is detected, which edits are produced) goes in `*.test.ts` and adapter plumbing (diagnostics collection, code actions, editor edits) in `*.spec.ts`. Don't re-assert domain results in the spec.
- Keep mocking minimal. Never mock anything in `packages/foam-core`. Write code that's testable without mocks; use real I/O in temp directories when needed.
- Use the helpers in `packages/foam-vscode/src/test/` (`test-utils.ts`, `test-utils-vscode.ts`, `test-datastore.ts`) and `packages/foam-core/test/`.
- Set up and tear down inside the test case rather than `beforeEach`, unless that's genuinely clearer.
- Name test cases after the behavior being verified — they document expected behavior. Cover happy paths and edge cases.
- When several tests fail, read them all, then fix only the first. Re-run and repeat.
- Performance-sensitive paths have `*.bench.ts` benchmarks (`yarn bench`). CI compares against a cached baseline and fails on a 2x regression; there is no committed baseline file to update.

## Conventions with teeth

**`packages/foam-core` is the platform-agnostic core.** No `vscode` import. No Node `path` — it runs in browser and React Native too, so use the POSIX-safe helpers in `src/utils/path.ts` (`relativeTo`, `joinPath`, `getBasename`, `getExtension`, `getDirectory`). vm-dependent scripting exports (`TemplateLoader`, `resolveDailyNote`, `noteCreate`, `renderJsQuery`) live behind the `@foam/core/scripting` subpath to keep the main barrel bundler-safe.

**Separate domain logic from VS Code bindings everywhere, not only in core.** In `foam-vscode`, `src/lint/` and `src/daily-note/` are domain code with no `vscode` import; `src/vscode/` is the adapter that reads config, registers commands and providers, and calls in. Domain functions take explicit parameters — the VS Code layer reads `getFoamVsCodeConfig` and passes values in; the domain function never reads config itself. A thin `vscode` dependency (progress, logging) doesn't make a file VS Code-specific: replace that one import with a small interface rather than moving the whole file into the adapter layer.

`packages/foam-vscode/src/core/` is a legacy shim holding only `model/foam.ts` (extends core's `Foam` with `embeddings`). Don't add to it.

**A `@foam/core` change needs a changeset that also lists `foam-vscode` and `@foam/cli`** (usually `patch`). They bundle core at build time via esbuild and declare it a `devDependency`, so Changesets won't cascade the bump — without this their republished bundles ship new code under a stale version with no changelog. See `docs/dev/releasing-foam.md`.

**URIs throughout, paths only at the edges.** Domain code takes and returns `URI`, not path strings — consistent with `FoamWorkspace.find(uri)`, `FoamGraph.getLinks(uri)`, `Resource.uri`.

```typescript
function listOrphans(workspace, graph, rootUri: URI): NoteItem[]; // ✅
function listOrphans(workspace, graph, rootDir: string): NoteItem[]; // ❌
```

Path strings appear only at I/O boundaries (`IDataStore` converting URI ↔ fs path), external wire formats (CLI args, MCP inputs, JSON), and human-readable display fields alongside the URI.

**Static imports only.** No `await import(...)` or `import(...)` in source or tests. For late-bound mocks use a top-level `vi.mock`, dependency injection, or an explicit hook.

**No wrappers that just rename a call.** Before extracting a helper, ask whether it adds clarity, reuse, or non-trivial logic. An `applyNoteEdits(text, issues)` that only calls `TextEdit.apply` is noise — call `TextEdit.apply`.

**Use the project's vocabulary.** "Workspace", never "vault" (that's Obsidian's term). Avoid "gated" framing for access levels — prefer "accessible to X". Name a method after what it wraps rather than inventing a new term.

**Put files in their proper home.** Test-only fixtures in a test folder. Generated artifacts in build output — gitignoring them inside source isn't enough. Deliverables in the project, not `/tmp`. `.agent/` is local scratch for plans and issue research.

Prefer pure functions where practical. Reuse existing helpers and constants instead of adding parallel ones.

## Non-obvious architecture

Monorepo: `packages/{foam-core,foam-vscode,foam-graph,foam-cli,foam-mcp}`.

Things you won't infer quickly from reading:

- **FoamWorkspace** uses a reversed trie for resource lookup, which is what makes short-form identifier resolution work.
- **FoamGraph** creates placeholder resources for broken links — they're real graph nodes, not absences.
- **ResourceProvider** is the extension point per file type (`MarkdownProvider`, `AttachmentProvider`).
- **Features** are registered as `(context: ExtensionContext, foamPromise: Promise<Foam>) => void` in `packages/foam-vscode/src/vscode/features/index.ts`.
- **Lint rules** share one `LintIssue` model (`packages/foam-core/src/lint/lint.ts`). Rules return `LintIssue[]` with messages pre-formatted in the domain layer; `lintIssueToDiagnostic` in `src/vscode/utils/vsc-utils.ts` maps them to VS Code diagnostics with no rule-specific logic. A new rule is a new domain file, not a new adapter.
- **The graph webview** is a Lit web component in `packages/foam-graph/`. `packages/foam-vscode/static/dataviz/` is gitignored build output, not source. `src/protocol.ts` owns the extension↔webview message contract. The extension resolves `@foam/graph-view/*` via the package `exports` map for typechecking; esbuild resolves the same way at bundle time.
- **`foam-extension-test-host.ts`** does not activate AI features — the mock Foam has no embeddings.

## User documentation (`docs/user/`)

Written for people new to Foam who may not be technical. Show how to use a feature, not how it works internally. Lead with the most common use case, use concrete examples, and keep it short — users won't read verbose docs, and every sentence must convey something new.

## Pointers

- Extension settings (`foam.*` namespace): `packages/foam-vscode/package.json`
- Release process and changeset rules: `docs/dev/releasing-foam.md`
- Testing details: `docs/dev/testing-conventions.md`
- GitHub: use `gh`. Reads freely; **never write without being asked**.
