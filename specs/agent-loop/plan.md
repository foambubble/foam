# Plan: Implement and review loop

## Approach

A private workspace package, `packages/agent-loop` (`@foam/agent-loop`), in
TypeScript that Node runs directly: Node 22 strips types without a flag
(checked on 22.23.1), so there is no build output, and the package's `build`
script is `tsc --noEmit` so `yarn build` still typechecks it. The root gets an
`agent-loop` script that forwards to the package. `scripts/agent-loop.mjs` is
deleted; nothing of it survives except the briefs' wording.

Sessions run through the Agent SDK (`@anthropic-ai/claude-agent-sdk`, as
dev-loop does in `~/code/dev-loop/agents.ts`) rather than `claude -p`. Each
session returns its result as schema-validated structured output, so the
loop never reads back a file a session was asked to write, which is how the
stale-output defect arose. The loop writes the run record; it never reads
it. The SDK's message stream also gives the terminal its progress lines.

The code splits into the loop and what it is wired to. `loop.ts` is pure
orchestration over three injected parts: the sessions (coder, reviewer, cold
reviewer), the feedback queue, and the gate commands. It imports neither the
SDK nor the terminal. `sessions.ts` is the SDK adapter, `terminal.ts` the
local feedback queue, `local.ts` wires the local versions together, and
`cli.ts` turns argv into a call to it. `agent-loop-ci` later adds GitHub
versions of the feedback queue, the cold pass and the result, and a second
wiring beside `local.ts`, without touching `loop.ts`. There is no delivery
interface yet: locally the result is printed by `local.ts`, and CI will add
what it needs.

## Work breakdown

1. **Branch and graduate.** `feature/agent-loop` from local `main`, which
   carries the seven unpushed commits, including the workflow fixes in
   67e53286 and the script this replaces. First commit copies
   `specs.local/agent-loop/spec.md` and this plan into `specs/agent-loop/`.
2. **Package skeleton.** `package.json` (private; `build`, `test`,
   `test:unit`, `lint: oxlint src`, `bench` as a no-op echo like
   `@foam/mcp`'s, `start`), `tsconfig.json` modelled on dev-loop's
   (`noEmit`, `allowImportingTsExtensions`, `erasableSyntaxOnly`),
   `vitest.config.ts`. Dependencies: the SDK at dev-loop's version, `zod`
   `^4` as `@foam/mcp` has it. Add `@foam/agent-loop` to the Changesets
   `ignore` list beside `@foam/mcp`, add a "Test @foam/agent-loop" step to
   `ci.yml`'s build-and-test job, and add the root `agent-loop` script.
3. **Contracts** (`contracts.ts`): zod schemas for the coder's result
   (`blocked`, `summary`, `outcomes[{id, outcome: fixed|rejected, reason}]`),
   the reviewer's and the cold reviewer's findings
   (`findings[{path, line, tier: MUST_FIX|SHOULD|NIT, finding}]`). Finding IDs
   are assigned by the loop, never by a model.
4. **Loop, test first** (`loop.test.ts` → `loop.ts`), with the defect's
   criteria first: AC-9 and AC-10, then AC-5, AC-7, AC-8, AC-11, and the
   brief contents for AC-2 to AC-4. Tests use a real git repository in a temp
   directory, fake sessions that commit through git and return scripted
   output, real gate commands (`node -e "process.exit(1)"`), and an in-memory
   feedback queue.
5. **Start** (`start.test.ts` → `start.ts`): from the repo root and branch,
   find `specs/<slug>/spec.md` or `specs.local/<slug>/spec.md`, where the
   slug is the branch minus everything up to the first `/`, and refuse with
   the AC-1 message otherwise.
6. **Briefs** (`briefs.ts`): coder round 1, coder round N, reviewer, cold
   reviewer. Pure functions, tested through `loop.test.ts` and
   `briefs.test.ts`.
7. **Render** (`render.test.ts` → `render.ts`): the summary from the loop's
   result.
8. **Gate** (`gate.ts`): runs `yarn build`, `yarn lint` and `yarn test` from
   the repo root in order, stopping at the first failure, and returns which
   command failed and its output.
9. **SDK adapter** (`sessions.ts`), with its tool hooks unit-tested as plain
   functions in `sessions.test.ts`.
10. **Terminal** (`terminal.test.ts` → `terminal.ts`): lines read from an
    input stream into the queue; progress lines out.
11. **Local wiring and CLI** (`local.test.ts` → `local.ts`, `cli.ts`).
12. **Delete `scripts/agent-loop.mjs`.** `yarn lint`, `yarn test`.
13. **First local run**, which is where AC-6 is verified: a scratch branch
    with a small spec, `--rounds 1`, reading the run record.

## AC verification map

- AC-1 → `packages/agent-loop/src/start.test.ts`
- AC-2 → `packages/agent-loop/src/loop.test.ts` (the brief given to the fake
  coder names the spec)
- AC-3 → `packages/agent-loop/src/loop.test.ts`
- AC-4 → `packages/agent-loop/src/loop.test.ts` (queue filled before start)
- AC-5 → `packages/agent-loop/src/loop.test.ts` (a failing gate command: the
  reviewer is never called, the next coder brief carries the output, the
  round counts)
- AC-6 → human, on the first local run: the reviewer's tool calls are in the
  run record, and none of them touches `plan.md`. Supported by
  `packages/agent-loop/src/sessions.test.ts` for the hook's logic.
- AC-7 → `packages/agent-loop/src/terminal.test.ts` (stream to queue) and
  `packages/agent-loop/src/loop.test.ts` (joins the next round, never twice)
- AC-8 → `packages/agent-loop/src/loop.test.ts`, one case per stop reason,
  plus waiting feedback keeping a clean review from stopping the loop
- AC-9 → `packages/agent-loop/src/loop.test.ts` (a fake session returning
  the wrong shape stops the run naming it, with a previous run's valid
  record on disk)
- AC-10 → `packages/agent-loop/src/loop.test.ts` (two runs in one repo)
- AC-11 → `packages/agent-loop/src/loop.test.ts` (the cold brief carries no
  finding or outcome, cold findings reach the result and no coder, and no
  cold pass runs when the coder is blocked)
- AC-12 → `packages/agent-loop/src/local.test.ts` (a temp repo with a bare
  remote: the remote's ref is unchanged after a run, and the summary is on
  the output stream)
- AC-13 → `packages/agent-loop/src/render.test.ts`

## Decisions

- **The Agent SDK over the CLI.** Structured output validated by zod removes
  the file contract, which is where AC-9's defect lived. The CLI has no
  schema-validated output to hand back.
- **Tool restrictions are enforced by a `PreToolUse` hook, not by
  `allowedTools` with `canUseTool`.** The SDK documents `allowedTools` as
  "auto-allowed without prompting", and read-only tools like `Read` don't
  prompt at all, so a `canUseTool` check can be skipped for exactly the call
  AC-6 is about. Hooks run on every tool call. The reviewer's hook denies any
  tool input that mentions `plan.md` and limits Bash to `git diff`,
  `git log`, `git show` and read utilities. The coder's hook denies
  `git push` and every `gh` command, because nothing in a local run needs
  GitHub; `agent-loop-ci` opens read-only `gh`. `tools` limits what each
  session has at all.
- **`settingSources: ['project']`.** `CLAUDE.md`, and through it `AGENTS.md`,
  load for every session as for any contributor. User and local settings
  don't, so a run on the maintainer's machine behaves like one in CI.
  `.claude/settings.json` does not exist, so this loads nothing else.
- **Round 1 points the coder at `.claude/skills/implement/SKILL.md` steps 1
  to 5 by path, rather than invoking the skill.** Steps 6 to 8 rewrite the PR
  description, push and mark ready, which is what the loop and CI own. The
  skill stays the one description of how to implement.
- **The gate builds before it tests.** `packages/foam-cli/vitest.config.ts`
  resolves `@foam/core` to its build output, unlike
  `packages/foam-vscode/vitest.config.mts:52`, which aliases it to source.
  Without the build, a core change would be tested against stale core. This
  matches the order in `ci.yml`.
- **`ELECTRON_RUN_AS_NODE` is removed from the environment of the gate and of
  every session.** A run started from a Claude Code terminal inherits it, and
  the foam-vscode e2e suite then fails for reasons unrelated to the change.
- **Models stay as the workflows have them**: `claude-opus-5` for the coder
  as in `claude.yml`, and `claude-fable-5-1` for the reviewer and the cold
  pass as in `review.yml`. Opus 5.5 exists. Moving to it is a one-line change
  in both places and is left to the maintainer.
- **The run record**: `.agent-loop/<slug>/<run>/` with `<run>` an ISO
  timestamp safe for file names, and `round-N/` holding each brief, each
  session's validated output, the gate's output and a log of every tool call.
  `.agent-loop` is already gitignored. The loop writes only after
  validating, so an invalid session output is never written as a valid one.
- **The spec has no open questions left**; both were settled with the
  maintainer on 2026-09-23.

## Risks

- **The fakes can pass while the SDK adapter is wired wrong.** Every loop
  criterion is tested against fake sessions, so a broken `sessions.ts`, or
  a hook that never fires, passes CI. The first local run covers it: the run
  record's tool-call log shows what the hooks allowed and denied. No unit test
  can, short of calling a model.
- **The SDK's permission order is taken from its type documentation, not
  from a test.** If `PreToolUse` hooks don't see every call, AC-6 fails
  silently. The tool-call log on the first run is where to check.
- **`yarn test` is slow.** It runs the foam-vscode e2e suite every round.
  Accepted: that is the suite CI runs, and a faster gate would let through
  what CI catches.
- **dev-loop's gates may never fire.** `~/code/dev-loop/agents.ts` passes
  every tool in `allowedTools` together with a `canUseTool` gate, which the
  first decision above suggests is skipped. Not verified, and dev-loop is out
  of scope here.
