---
type: feature
created: 2026-11-25
---

# UI tests for acceptance criteria

## Context

Every acceptance criterion says how it is verified: `unit`, `e2e` or `human`.
`e2e` means a `*.spec.ts` in the VS Code extension host. It calls the VS Code
API but can't see the drawn window: webviews such as the graph, editor widgets
such as completion and hover, theme colours, what survives a window reload, or
behaviour in another editor such as the built-in Markdown Editor. Criteria
about those are `human` today. Of the 13 `human` criteria across 7 specs in
`specs/`:

- about 7 are facts about the window a test could check, for example:
  - `1787-graph-hide-controls` AC-7: the panel is still hidden after a reload;
  - `1205-graph-view-config` AC-6: a preference survives a reload;
  - `1742-open-notes-in-associated-editor` AC-7: Foam's completion and hover
    in the Markdown Editor.
- 2 are judgment calls: `1787` AC-6 "findable, legible in both themes", and
  `graph-view-host-options` AC-8.
- 4 are not about the window (docs, CI matrix, code structure).

The maintainer asked for a fourth tier on 2026-11-25, after the README GIFs were
re-recorded by driving a real VS Code window. The tests should satisfy four
decisions:

- They are written during implementation, for the mechanical `human` criteria.
- They are reviewed like any other test.
- They never run as part of CI, which is already slow and would gain little,
  with two exceptions: a branch that adds a UI test runs it in that PR's
  checks, and a branch that changes the harness every UI test runs on runs
  them all (decided in review, 2026-11-26).
- Otherwise they run weekly in a workflow of their own, and manually when a
  release is cut. For now, nothing else. They keep an executable list of
  expected behaviour without loading every PR.

Facts a plan will need:

- **Prior art:** the rig that recorded the GIFs is in `.agent/readme-gifs-rig`.
  It is gitignored and only in the main checkout. It drives a VS Code window
  with this checkout's extension, a fresh profile and a generated workspace.
  It finds editor text, side-bar rows and menus in the drawn window, and saves
  frames.
  - It hard-codes paths into another session's worktree, and the macOS arm64
    VS Code 1.144.0 binary.
  - `playwright-core` is not declared in any `package.json`.
  - It keeps profiles under a short `/tmp` path because of the socket path
    length limit.
  - From a Claude Code terminal it needs `env -u ELECTRON_RUN_AS_NODE`.
  - It locates elements by VS Code's internal CSS classes, which change between
    VS Code versions.
- **Bugs it found:** recording turned up four bugs the suites missed. One, the
  racy `#` commit in wikilink completion, is fixed in 9fbdad12.
- **Test runners:** e2e runs `src/**/*.spec.ts` on VS Code 1.136.0
  (`packages/foam-vscode/src/test/run-tests.ts`) under `xvfb-run` in
  `ci.yml`. Unit runs `src/**/*.test.ts` plus `@unit-ready` specs.
- **Implementation:** runs locally, or through `@claude implement` in
  `claude.yml`, which runs on Linux with a display.
- **Review:** runs in `review.yml`, which only checks out the code: no install,
  no build, no display. It already lists `_verify: human_` criteria under
  "Review by hand".
- **Releases:** the maintainer pushes per-package tags, and `release.yml`
  publishes each one (`docs/dev/releasing-foam.md`).

## Acceptance criteria

- **AC-1**: Given a `*.ui.ts` test in `packages/foam-vscode/src`, when a
  contributor runs the documented UI test command from a built checkout, then
  the test runs in a real VS Code window with this checkout's extension, a
  fresh profile and a workspace whose files the test defines. The command
  reports each test's result and exits non-zero if any failed.
  _verify: human_
- **AC-2**: Given `yarn test:unit`, `yarn test:e2e` and `yarn test`, then none
  of them runs a `*.ui.ts` file, and the UI test command runs no `*.test.ts`
  or `*.spec.ts` file.
  _verify: human_
- **AC-3**: Given the UI tests in the repo, then together they show that a test
  can:
  - type and click in the editor, and read what is drawn there, including
    completion and hover;
  - read and operate side-bar views and a webview's content, such as the
    graph;
  - switch between a light and a dark theme;
  - reload the window and find the same workspace and profile afterwards.
  _verify: human_
- **AC-4**: Given a UI test that fails, then the run keeps a screenshot of the
  window at the point of failure and prints its path. Given any UI test, it
  can save named screenshots that the run keeps alongside.
  _verify: human_
- **AC-5**: Given `specs/1787-graph-hide-controls` AC-7, then a UI test stands
  for it:
  - it passes on the current extension;
  - it fails when the panel's hidden state is not kept across the reload;
  - the criterion reads `_verify: ui_`.
  _verify: human_
- **AC-6**: Given `specs/README.md`, `docs/dev/testing-conventions.md` and the
  write-spec skill, then they describe `ui` as a fourth verification level: a
  `*.ui.ts` test, run outside CI except in the pull request that adds it.
  They say the UI tests run weekly, and manually before a release. They say
  to choose `ui` only for a criterion about the window that the VS Code API
  can't check, and that judgment criteria ("legible", "findable") stay
  `human`.
  _verify: human_
- **AC-7**: Given a spec with a `human` criterion that is a mechanical fact
  about the window, when the implement stage builds it, then it:
  - writes that criterion's UI test before the change;
  - runs it to see it fail for the criterion's reason, then makes it pass;
  - changes the criterion to `_verify: ui_` in the same PR.

  For a judgment `human` criterion, it saves screenshots of the behaviour and
  says in its report where to find them.
  _verify: human_
- **AC-8**: Given a PR that adds or changes a `*.ui.ts`, when it is reviewed,
  then the review checks each such test against the wording of the criterion
  it stands for. It confirms the test asserts the behaviour, not only that an
  element exists. It lists under "Review by hand" any test it could not
  confirm.
  _verify: human_
- **AC-9**: Given the GitHub workflows, then:
  - a pull request's checks run no UI test, except the `*.ui.ts` files that
    pull request adds, and only those;
  - a pull request that changes the harness the UI tests share runs all of
    them in its checks;
  - a workflow of their own runs all the UI tests on Linux, weekly against
    `main` and when started manually;
  - a failing run shows as a failed workflow run.
  _verify: human_
- **AC-10**: Given `docs/dev/releasing-foam.md`, then it says to start the UI
  test workflow manually before tagging a release, and to look at any failure
  before going ahead.
  _verify: human_

## Out of scope

- **GIFs and PR images:** recording README GIFs with the same tooling, a skill
  for feature GIFs, and images in implementation or review reports. They are
  separate work that can build on this one. The GIF takes stay in
  `.agent/readme-gifs-rig` until then.
- **CI:** running UI tests as part of CI, beyond the tests a pull request
  adds, for the reasons in Context.
- **Other manual runs:** for now the manual run is only for releases. Other
  occasions, such as changing the pinned VS Code version, can be added later.
- **Pixel comparison:** screenshots are evidence for a person, not baselines to
  diff. Fonts and rendering differ between machines.
- **Other existing criteria:** converting the other mechanical `human`
  criteria. Each converts when its feature is next touched; AC-5 is the pilot.
- **Other platforms:** macOS or Windows runs in CI, and VS Code for the Web.
- **Release gating:** blocking publishing on a failing UI run. AC-10 asks for a
  look, not a gate.

## Open questions

- **Which VS Code version?** e2e pins 1.136.0, and the rig used 1.144.0.
  Converting `1742` AC-7 later needs 1.142 or newer, where the Markdown Editor
  calls extension completion. Assumed: one pinned version for UI tests, picked
  in the plan, preferably shared with e2e.
- **Should review run the tests itself?** `review.yml` has no install, build or
  display today. Assumed: review checks UI tests by reading them (AC-8), while
  the tests a pull request adds run in its checks (AC-9). Running them in
  review is left for later.
- **What about changed tests?** Only added tests run in a pull request's
  checks, so a pull request that changes an existing UI test doesn't run it in
  CI. Assumed: the implement stage runs it (AC-7), and the weekly run catches
  the rest.
- **Weekly, and who hears about failures?** Assumed weekly. GitHub sends
  scheduled-run failures to whoever last edited the schedule, which is assumed
  to be enough.
- **Split?** At ten criteria this could become two stacked specs:
  1. the tier and the pilot (AC-1–AC-5, AC-9);
  2. the process around it (AC-6–AC-8, AC-10), stacked on the first.

  Assumed: one spec, since one session will carry it.
