# Plan: Link a daily note to the previous one

## Approach

The variable resolves in `packages/foam-core/src/templates/variable-resolver.ts`,
where every other `FOAM_*` variable lives. The lookup itself is a pure function
in core that reads the workspace, because that is what makes AC-7 (no time
window) possible: `FoamWorkspace` is already in memory and `list()` is a plain
array scan, so the search is bounded by the notes that exist rather than by a
number of days walked backwards. The alternative — computing the expected
filename for yesterday, the day before, and so on until a file is found — is
the one the maintainer ruled out, and it is also the one that would force a
bound, since an empty workspace gives it no stopping point.

The `Resolver` does not gain a `FoamWorkspace`. It gains an optional lookup
callback, `(before: Date) => string | undefined`, passed by the two places that
create daily notes: `daily-note-service.ts:218` (VS Code) and
`daily-note-resolver.ts:44` (core, used by `foam daily`). A callback keeps the
resolver free of a model dependency, keeps the variable out of the general
`new-note` flow the spec puts out of scope (`create-note.ts:172` simply does
not pass one), and sidesteps `create-note.ts:183`, which `JSON.stringify`s the
whole resolver at debug level — a workspace field there would serialize the
entire graph, a function field is dropped. Resolution stays lazy: `resolveText`
only resolves variables the template actually names, so AC-6 holds without a
guard.

Recognizing which resources *are* daily notes is the one place with no exact
answer (see Decisions). The rule is: strip the extension, and accept the
resource if its basename *starts with* a date in the configured
`openDailyNote.filenameFormat`. That covers both the default
`2026-09-18.md` and the `…-daily-note.md` shape documented at
`docs/user/features/templates.md:330`, without matching `meeting-2026-09-18.md`.
Parsing the format needs `convertDateformatToDayjs`, which today is private to
`daily-note-service.ts:48` in the VS Code package; it moves to core rather than
being copied.

## Work breakdown

1. **Move the dateformat→dayjs conversion into core.** New
   `packages/foam-core/src/utils/date-format.ts` holding
   `convertDateformatToDayjs` (moved verbatim from
   `packages/foam-vscode/src/vscode/features/daily-notes/daily-note-service.ts:48`,
   including `DATEFORMAT_NAMED_MASKS`) plus a new
   `matchDatePrefix(basename: string, format: string): Date | undefined`. The
   latter builds a regex from the same token set (`yyyy`→`\d{4}`,
   `mmmm`→`[A-Za-z]+`, `dd`→`\d{2}`, …), anchors it at the start of the
   basename, and strict-parses the matched substring with dayjs
   (`customParseFormat` plugin, already shipped with the pinned `dayjs@^1.11.13`).
   `daily-note-service.ts` imports the moved function instead of declaring it;
   its behaviour must not change.

2. **Add the lookup.** New
   `packages/foam-core/src/templates/previous-daily-note.ts`:
   `findPreviousDailyNote(workspace: FoamWorkspace, before: Date): URI | undefined`.
   Scans `workspace.list()`, keeps resources whose extension matches
   `Config.getDailyNoteFileExtension()` and whose basename yields a date via
   `matchDatePrefix(…, Config.getDailyNoteFilenameFormat())`, drops candidates
   whose date is not strictly before `before` **compared at day granularity**
   (`before` carries a wall-clock time; a same-day note must not count as
   previous), and returns the URI with the latest remaining date. Ties on the
   same date resolve by `Resource.sortByPath`, so the result is deterministic.

3. **Resolve the variable.** In `variable-resolver.ts`: add
   `FOAM_PREVIOUS_DAILY_NOTE` to `knownFoamVariables` (line 15 — without this
   `snippetTextWithVariablesSubstituted` leaves the token as literal text, which
   is exactly the failure AC-3 names), add the optional callback as a 6th
   constructor parameter, and add a `case` that returns its result or
   `undefined`. Returning `undefined` is what gives AC-2 its fallback:
   `Variable.resolve` at `snippetParser.ts:481` only replaces children when the
   value is defined, so `${FOAM_PREVIOUS_DAILY_NOTE:…}` keeps its default.

4. **Wire the two daily-note flows.** `daily-note-service.ts:218` and
   `daily-note-resolver.ts:44` pass
   `date => { const uri = findPreviousDailyNote(foam.workspace, date); return uri && foam.workspace.getIdentifier(uri); }`.
   `getIdentifier` (`workspace.ts:341`) is what AC-5 asks for — the same minimal
   identifier wikilink completion produces, extension stripped.

5. **Docs.** A row in the variable table in
   `docs/user/features/templates.md` (after `FOAM_CURRENT_DIR`, line 248) and a
   short daily-note-template example in
   `docs/user/features/daily-notes.md` showing `[[$FOAM_PREVIOUS_DAILY_NOTE]]`
   and the `${FOAM_PREVIOUS_DAILY_NOTE:no previous note}` fallback. The
   recognition rule (basename starts with the configured filename format) is
   documented there, since a user with an unusual template needs to know it.

6. **Changeset.** `@foam/core` minor, plus `foam-vscode` and `@foam/cli` patch —
   they bundle core at build time, so Changesets will not cascade the bump.

## AC verification map

- AC-1 (gaps skipped) → `packages/foam-core/src/templates/previous-daily-note.test.ts`
- AC-2 (`undefined` → template fallback used) → `packages/foam-core/src/templates/variable-resolver.test.ts`
- AC-3 (no fallback → empty, not literal `$FOAM_…`) → `packages/foam-core/src/templates/variable-resolver.test.ts`
- AC-4 (search anchored at the target date, not today) → `previous-daily-note.test.ts` (pass a `before` in the past and assert an earlier note wins over a later one)
- AC-5 (workspace identifier, no brackets or whitespace) → `variable-resolver.test.ts`, with the identifier itself covered in `previous-daily-note.test.ts`
- AC-6 (template without the variable → unchanged, lookup never called) → `variable-resolver.test.ts` with a spy callback
- AC-7 (years-old note still found) → `packages/foam-core/src/templates/previous-daily-note.test.ts`
- Wiring, VS Code → `packages/foam-vscode/src/vscode/features/daily-notes/daily-note-service.spec.ts`: create a daily note from a template containing the variable and assert the written content carries the link. Asserts the flow is connected, not the domain result.
- Wiring, CLI/core → a case in `packages/foam-core/src/templates/daily-note-resolver.test.ts`, which already builds a workspace via `createTestWorkspace`.

Core tests stub config with `Config.setDefaultConfig(…)`, as
`template-discovery.test.ts:20` does, and restore `DefaultFoamConfig` after.

## Decisions

- **How a daily note is recognized** (spec open question 2) → basename, minus
  extension, *starts with* a date in `Config.getDailyNoteFilenameFormat()`, and
  the extension matches `Config.getDailyNoteFileExtension()`. Whole workspace,
  no directory restriction. Restricting to `openDailyNote.directory` was the
  obvious alternative and is wrong: the built-in template writes to `/journal/`
  (`daily-note-service.ts:166`) while the directory setting defaults to `.`, so
  the two routinely disagree. Prefix-anchoring rather than
  match-anywhere is what keeps `meeting-2026-09-18.md` out. **This is a
  heuristic and it can be wrong in both directions** — a template whose filename
  does not lead with the date is invisible to it, and a non-daily note that does
  lead with a date is a false positive. Worth the maintainer's eye.
- **`[[]]` in the first daily note of a workspace** (spec open question 1) →
  accept it, document the fallback form instead. AC-3 requires the bare
  variable to vanish; the brackets sit outside it and nothing at resolution time
  can reach them. Teaching `${FOAM_PREVIOUS_DAILY_NOTE:…}` in the docs costs
  nothing and the one-off empty-workspace case does not justify machinery.
- **Config read inside `findPreviousDailyNote`** rather than threading format
  and extension from the call sites. `Config` is core's own accessor and
  `template-discovery.ts:15` sets the precedent; the VS Code host installs
  `VsCodeFoamConfig` at `extension.ts:45`, so the real user settings are already
  visible from core. The pure, branchy part (`matchDatePrefix`) still takes the
  format explicitly and is tested directly.
- **Callback instead of passing `FoamWorkspace` to `Resolver`** — see Approach.
  It also keeps the variable from silently appearing in `new-note` templates,
  which the spec puts out of scope.

## Risks

- **The variable resolves during filepath resolution too.** A template whose
  `foam_template.filepath` contains `$FOAM_PREVIOUS_DAILY_NOTE` would put an
  identifier — possibly with a `/` — into a path. Nothing here prevents that,
  and nothing did before for other variables either. Not worth guarding; worth
  knowing.
- **Moving `convertDateformatToDayjs` out of `daily-note-service.ts` touches
  the filename/link/title formatting that every daily note goes through.**
  `daily-note-service.spec.ts` and
  `packages/foam-vscode/src/daily-note/daily-note-snippets.test.ts` are the
  safety net; if the move is not behaviour-identical they fail.
- **`workspace.list()` on every resolution.** One array scan per daily note
  created, in memory, only when the template names the variable. Not worth
  caching, and a cache would have to be invalidated on every workspace change.
- **The recognition heuristic is the only part users will notice going wrong.**
  There is no test that can prove it right for every template; AC-1 and AC-7
  pin the common shapes, and the docs state the rule.
