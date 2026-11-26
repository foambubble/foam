# Plan: UI tests for acceptance criteria

## Approach

A third Vitest config, `packages/foam-vscode/vitest.ui.config.mts`, includes
only `src/**/*.ui.ts`. It runs the files one at a time, in Node, with long
timeouts. Each test drives a real VS Code window through `playwright-core`'s
Electron launcher. It's Vitest rather than Playwright Test because unit and e2e
already run on Vitest (`vitest.config.mts`, `src/test/suite.ts:89`), with its
`expect` and reporter. Playwright Test's screenshot-on-failure is tied to its
browser `page` fixture, which an Electron launch doesn't get, so the harness
would need its own fixture anyway, plus a second runner and config dialect.
`playwright-core` becomes a declared devDependency of `foam-vscode`. It
downloads no browsers.

The harness lives in `src/test/ui/`. `openVSCode({ files, settings })` creates
a temp dir under `os.tmpdir()`, which keeps the user-data dir short enough for
the socket path limit: about 75 characters on macOS, against a limit of 104.
It writes the test's workspace files and a small fixed set of user settings,
then launches the downloaded build with this package as
`--extensionDevelopmentPath` and a fresh `--user-data-dir` and
`--extensions-dir`. The settings switch off whatever would make the window
nondeterministic: the chat side bar, tips, the startup editor, telemetry,
updates and workspace trust. It also starts on a fixed theme.

It removes `ELECTRON_RUN_AS_NODE` from the child's environment itself. Foam
declares no activation events, so nothing activates it at startup. The harness
runs "Foam: Show What's New". VS Code runs a command only after its extension
has finished activating, and Foam's activation includes loading the workspace
(`extension.ts:180`), so the What's New page opening means Foam is ready. The
harness then dismisses the fresh-profile notice and closes the page with its
tab's Close button. A key pressed into that page, a webview still loading, is
lost. An `onTestFinished` hook screenshots the window when the test failed,
prints the path, then closes VS Code and removes the temp dir.

The window object offers only what the tests use:
- `openFile` (quick open);
- `runCommand` (palette, matched by title prefix). It fills the palette's
  textbox instead of typing, and presses F1 again if the palette hasn't
  opened: a key pressed in a webview reaches the workbench asynchronously;
- `editorLines` and `hoverText`;
- `webview(selector)` (the frame whose document has it);
- `updateSettings` (rewrites the user `settings.json`, which VS Code picks up
  live);
- `reload` (Developer: Reload Window, then wait for the workbench);
- `screenshot(name)`;
- the raw `page`, for everything else.

The tier finds elements by role, not by CSS class, which fixes the rig's
coupling to VS Code's internals. The probes run while planning (VS Code 1.136.0
on macOS) confirmed these handles:
- completion is `listbox "Suggest"`, with options named like `beta.md, File`;
- the hover is `role=tooltip`, and its text is the note;
- side-bar views are `tree`/`treeitem` with names, and their headers are
  buttons;
- the palette is a `listbox` of `option`s named after the command, which is
  why matching is by prefix: an option with a keybinding carries it in its
  name;
- webview contents are reached through Playwright frames, and its locators
  pierce the graph's open shadow roots, so buttons are found by `aria-label`;
- the theme shows in the webview's `vscode-light`/`vscode-dark` body class,
  which is VS Code's documented contract for webviews.

The one exception is the editor's drawn lines. `role=code` gives its text in
DOM order, not line order, so `editorLines` and `hoverText` read Monaco's
`.view-line` elements sorted by position. That class lives in the harness and
nowhere else.

`src/test/ui/global-setup.ts` downloads VS Code with `@vscode/test-electron`'s
`downloadAndUnzipVSCode`, the way `run-tests.ts` does, and hands the
executable path and the results dir, `out/ui-test-results/`, to tests
through Vitest's `provide`/`inject`. The version and the platform helper
move from `run-tests.ts:9-21,62-63` into `src/test/support/vscode-version.ts`,
which both runners import. The script is
`"test:ui": "yarn build && vitest run --config vitest.ui.config.mts"`. Yarn v1
appends arguments, so `yarn workspace foam-vscode test:ui <file>…` runs only
those files.

## Work breakdown

1. Add `playwright-core` to `packages/foam-vscode/package.json`. Extract
   `src/test/support/vscode-version.ts` and import it from `run-tests.ts`.
2. Harness, global setup, `vitest.ui.config.mts`, and the `test:ui` script.
3. AC-5 pilot, `src/vscode/features/graph-webview/graph-controls-panel.ui.ts`:
   - Open the graph, hide the panel, wait out the view-state save debounce
     (`VIEW_STATE_DEBOUNCE_MS`, 250 ms, in `foam-graph/src/host-bridge.ts:4`,
     which isn't exported), reload, open the graph again, and expect the show
     control and no hide control. The graph is opened after the reload, as
     the criterion says. Building this showed that a restored graph tab stayed
     blank until something else activated Foam; `1e6bc167` on `main` fixed
     that with an `onWebviewPanel:foam-graph` activation event.
   - Red first: temporarily drop `showControlPanel` from what
     `saveViewState` (`view-state-store.ts:31`) stores, run it, and confirm it
     fails at the post-reload assertion with a failure screenshot path
     printed. Then revert and run it green.
   - Change `specs/1787-graph-hide-controls/spec.md` AC-7 to `_verify: ui_`.
4. The rest of AC-3:
   - a theme case in the same file: the show control takes the theme's
     colours in dark and light, with named screenshots of both, which are
     evidence for 1787 AC-6, a judgment criterion that stays `human`;
   - `navigation/link-completion.ui.ts`: `[[` offers the workspace's notes and
     accepting one writes the link, and hovering a wikilink shows the linked
     note. Typing happens in an empty note, so no platform-specific key is
     needed to reach the end of a document;
   - `notes/connections.ui.ts`: the Connections view lists the notes that link
     to the active note, and opening one shows it in the editor.
5. `.github/workflows/ui-tests.yml`. The cache keys in `ci.yml` (three jobs),
   `claude.yml`, `deploy-docs.yml`, which shares the key, and the new workflow
   hash `vscode-version.ts` instead of `run-tests.ts`. `claude.yml` uploads `out/ui-test-results` with
   `if: always()`.
6. Process:
   - `specs/README.md` and `docs/dev/testing-conventions.md` (AC-6), with
     matching lines in `AGENTS.md` (the test table and the Testing section) and
     `CONTRIBUTING.md` (Testing);
   - the write-spec skill (AC-6), the implement skill (AC-7), the `review.yml`
     prompt (AC-8), and `docs/dev/releasing-foam.md` (AC-10).
7. Verify: `yarn test`, `yarn lint`, the full `test:ui`, the AC-2 listing
   checks, and the workflow's file-listing step run locally on a throwaway
   merge commit.

## AC verification map

Every criterion is `_verify: human_`. Each line names the evidence a person
checks.

- AC-1 → a full run of `yarn workspace foam-vscode test:ui` lists each test
  and its result. The red run in step 3 exits non-zero.
- AC-2 → `vitest list` under each config: the unit config and the e2e include
  (`suite.ts:91`) list no `*.ui.ts`, and the UI config lists only `*.ui.ts`.
  `test:ui` given a `*.spec.ts` path runs nothing.
- AC-3 →
  - editor typing, clicking, completion and hover: `link-completion.ui.ts`;
  - side-bar view: `connections.ui.ts`;
  - webview: `graph-controls-panel.ui.ts`;
  - theme: its theme case;
  - reload: its pilot case. The reloaded window reopens the same workspace,
    the Explorer lists the test's files, and the panel state comes back from
    that profile's workspace storage, which a different profile wouldn't have.
- AC-4 → the red run prints `failure.png`'s path. The theme case saves named
  screenshots under `out/ui-test-results/`.
- AC-5 → `graph-controls-panel.ui.ts`: red by mutation, then green, and the
  1787 spec edit.
- AC-6 → the diffs of `specs/README.md`, `testing-conventions.md` and the
  write-spec `SKILL.md`.
- AC-7 → the implement `SKILL.md` diff.
- AC-8 → the `review.yml` prompt diff.
- AC-9 → `ui-tests.yml`. This PR adds three `*.ui.ts`, so its own checks are
  the first Linux run.
- AC-10 → the `releasing-foam.md` diff.

## Decisions

Settled with the maintainer on 2026-11-25:

- **VS Code version** → 1.136.0, shared with e2e through `vscode-version.ts`.
  Playwright was checked against it while planning. Converting 1742 AC-7 later
  bumps it for both tiers.
- **Should review run the tests?** → No. It reads each added or changed
  `*.ui.ts` against its criterion's wording, and lists the ones it can't
  confirm under "Review by hand". No install, build or display is added to
  `review.yml`.
- **Changed tests** → the author runs them: implement runs every UI test it
  adds or modifies, and the weekly run catches the rest. The PR check stays
  "added only", as AC-9 says.
- **Weekly, and who hears** → `cron: '0 6 * * 1'` against `main`. GitHub's
  default email for a failed scheduled run is enough.
- **Split?** → No: one spec and one PR, so the process docs land with the
  runner they describe.
- **How the PR check finds added tests** → `ui-tests.yml`:
  - `pull_request` with a `paths` filter on
    `packages/foam-vscode/src/**/*.ui.ts`;
  - checkout `fetch-depth: 2`, then
    `git diff --name-only --no-renames --diff-filter=A HEAD^1 HEAD` on the
    merge commit, so a renamed test counts as added and runs;
  - a PR that adds none exits early.

  No third-party changed-files action, given the tj-actions compromise.
- **Screenshots** → `packages/foam-vscode/out/ui-test-results/<file>/<test>/<name>.png`
  and `failure.png`. They're build output. Each test empties its own
  folder when it runs, so separate runs don't wipe each other's evidence.
  They're uploaded as an artifact by `ui-tests.yml` and `claude.yml`.

Made while planning:

- The file list reaches the run step through `env:`, not `${{ }}`
  interpolation, so a crafted filename in a fork's PR can't inject shell.
- `xvfb-run` gets `--server-args='-screen 0 1600x1000x24'`, because the
  default screen is 640×480×8. The harness sets the window to a fixed content
  size, and turns on CDP focus emulation so a window without OS focus on macOS
  still takes keys.
- The harness strips `ELECTRON_RUN_AS_NODE`, so the documented command needs
  no `env -u` prefix.
- No root `test:ui` alias: only `foam-vscode` has UI tests, and
  `yarn workspace foam-vscode test:ui` is the documented command.

## Risks

- **Linux under xvfb is untested locally.** Docker isn't running on this
  machine. This PR's own `ui-tests.yml` run is the first Linux run.
  Sandboxing, GPU or font differences would surface there.
- **Readiness depends on Foam's What's New command and its fresh-profile
  notice.** If either changes, every UI test fails at launch, loudly, in one
  place: `activateFoam` in the harness.
- **Monaco's `.view-line` class** is the one internal selector. A VS Code bump
  that renames it breaks `editorLines` and `hoverText` in the harness only.
- **Fixed wait in the pilot**, for the 250 ms view-state debounce, which has
  no visible signal. The test waits with a margin, and comments the contract
  it waits on.
- **Cache keys change**, so CI's dependency and VS Code cache misses once.
- **Wiring:** the tier is reached locally, through the PR check,
  weekly/manual, and through `claude.yml`. Only the local path runs before
  merge. The PR path runs on this PR. The schedule, manual and `claude.yml`
  paths are read, not run.
