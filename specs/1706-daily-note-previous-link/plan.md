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

**A daily note is recognized by inverting the pattern that writes one.** Note
creation derives the daily note's path from a pattern; the same pattern, read
backwards, says which existing paths are daily notes. The pattern has one
source, in order:

1. the daily note template's `foam_template.filepath`, e.g.
   `/journal/${FOAM_DATE_YEAR}-${FOAM_DATE_MONTH}-${FOAM_DATE_DATE}.md`;
2. otherwise the settings — `openDailyNote.directory` + `filenameFormat` +
   `fileExtension`, which is exactly what `getDailyNoteUri`
   (`daily-note-service.ts:139`) builds and passes today as `fallbackFilepath`.

The template wins outright; the two are never combined. That mirrors
`note-creation-engine.ts:148`, where a template `filepath` makes
`defaultFilepath` unused, and it matches the settings' status — all three are
marked deprecated in `packages/foam-vscode/package.json:882-910` in favour of
the template, so the settings branch is the legacy path, not a supplement.

The pattern is turned into **one regex with the date parts as capture groups**,
and `workspace.list()` is scanned once: every resource whose path matches
yields a date from its groups, and the latest date strictly before the target
wins. Nothing is generated per day, so AC-7 costs nothing.

Where the two sources differ is only in syntax — the template pattern is
snippet variables (`${FOAM_DATE_YEAR}`), the settings pattern is dateformat
(`yyyy-mm-dd`) — so each is parsed into the same list of parts
(literal text | a `YYYY`/`YY`/`MM`/`M`/`DD`/`D` date token) and one inverter
turns that list into the regex. `$FOAM_TITLE` is a date part: both daily-note
flows that can resolve it set it to the formatted date first
(`daily-note-service.ts:216-217`), so it inverts as `YYYY-MM-DD`.

**If the parts do not yield year, month and day, the feature is unavailable in
that workspace** and the variable resolves to `undefined` — a pattern that only
carries year and month cannot name a day, and a part we cannot invert
(`FOAM_DATE_MONTH_NAME` / `mmmm`, which is `toLocaleString(locale, …)`, or a
day name, or a week number) makes the surrounding match untrustworthy too.
`undefined` is the same value AC-2 already defines for "no previous note", so
this needs no new resolution behaviour — just documentation of which patterns
are supported.

The `Resolver` does not gain a `FoamWorkspace`. It gains an optional lookup
callback, `(before: Date) => string | undefined`, passed by the two places that
create daily notes: `daily-note-service.ts:218` (VS Code) and
`daily-note-resolver.ts:44` (core, used by `foam daily`). A callback keeps the
resolver free of a model dependency, keeps the variable out of the general
`new-note` flow the spec puts out of scope (`note-create.ts:85` simply does not
pass one), and sidesteps `create-note.ts`'s debug logging, which
`JSON.stringify`s the whole resolver — a workspace field there would serialize
the entire graph, a function field is dropped. Resolution stays lazy:
`resolveText` only resolves variables the template actually names, so AC-6
holds without a guard.

## Work breakdown

1. **Move the dateformat→dayjs conversion into core.** New
   `packages/foam-core/src/utils/date-format.ts` holding
   `convertDateformatToDayjs` (moved verbatim from
   `packages/foam-vscode/src/vscode/features/daily-notes/daily-note-service.ts:48`,
   including `DATEFORMAT_NAMED_MASKS`). `daily-note-service.ts` imports the
   moved function instead of declaring it; its behaviour must not change. The
   settings branch of the pattern needs it, and copying it would leave two
   token tables to keep in step.

2. **Parse a path pattern into parts.** New
   `packages/foam-core/src/templates/daily-note-path-pattern.ts`:

   ```ts
   type PatternPart =
     | { kind: 'literal'; text: string }
     | { kind: 'date'; token: 'YYYY' | 'YY' | 'MM' | 'M' | 'DD' | 'D' };
   ```

   - `partsFromTemplateFilepath(filepath: string): PatternPart[] | undefined`
     parses with `new SnippetParser().parse(filepath, false, false)` rather
     than a bespoke regex, so `$FOAM_DATE_YEAR`, `${FOAM_DATE_YEAR}` and
     `${FOAM_DATE_FORMAT:YYYY-MM-DD}` are all handled the way resolution
     handles them. Text nodes become literals; variables map through a table
     (`FOAM_DATE_YEAR`→`YYYY`, `FOAM_DATE_YEAR_SHORT`→`YY`,
     `FOAM_DATE_MONTH`→`MM`, `FOAM_DATE_DATE`→`DD`, `FOAM_TITLE`→`YYYY-MM-DD`,
     `FOAM_DATE_FORMAT`→ its children parsed as a dayjs format); any other
     variable returns `undefined`.
   - `partsFromDayjsFormat(format: string): PatternPart[] | undefined`
     tokenizes a dayjs format string, honouring dayjs's own `[literal]`
     escape. Known y/m/d tokens become date parts; `MMMM`, `MMM`, `dddd`,
     `ddd`, `W`, `WW` and any other letter run return `undefined`;
     non-letters are literals.

3. **Invert the parts.** In the same file,
   `dailyNotePathMatcher(parts: PatternPart[]): ((path: string) => Date | undefined) | undefined`.
   Returns `undefined` unless the parts contain a year, a month and a day
   token — that is the "feature unavailable" case. Otherwise builds one regex:
   literals escaped, `YYYY`→`(\d{4})`, `YY`→`(\d{2})`, `MM`/`DD`→`(\d{2})`,
   `M`/`D`→`(\d{1,2})`, remembering which group is which unit; `YY` maps to
   `2000 + n`, the same century convention dayjs uses when formatting it. A
   pattern starting with `/` (the template convention, resolved against the
   workspace root by `workspace.resolveUri`) anchors at both ends; a relative
   pattern anchors at the end on a `/` boundary only, because `onRelativePath`
   (`note-factory.ts:41`) resolves relative template paths against the root
   *or* the current editor's directory depending on `files.newNotePath`, so its
   prefix is not knowable. Matching dates that do not exist (`2026-02-31`) are
   rejected by round-tripping through `Date`.

4. **Add the lookup.** New
   `packages/foam-core/src/templates/previous-daily-note.ts`:
   `findPreviousDailyNote(workspace, pattern, before: Date): URI | undefined`.
   Builds the matcher once, then scans `workspace.list()`, matching each
   resource against `workspace.relativePath(uri)` (`workspace.ts:138`), which
   returns the leading-slash workspace-relative form the template pattern is
   written in. Candidates whose date is not strictly before `before`
   **compared at day granularity** are dropped (`before` carries a wall-clock
   time; a same-day note must not count as previous), and the URI with the
   latest remaining date wins. Ties on the same date resolve by
   `Resource.sortByPath`, so the result is deterministic. No separate
   extension check: the extension is part of the pattern in both branches.

5. **Resolve the variable.** In `variable-resolver.ts`: add
   `FOAM_PREVIOUS_DAILY_NOTE` to `knownFoamVariables` (line 15 — without this
   `snippetTextWithVariablesSubstituted` leaves the token as literal text, which
   is exactly the failure AC-3 names), add the optional callback as a 6th
   constructor parameter, and add a `case` that returns its result or
   `undefined`. Returning `undefined` is what gives AC-2 its fallback:
   `Variable.resolve` in `snippetParser.ts` only replaces children when the
   value is defined, so `${FOAM_PREVIOUS_DAILY_NOTE:…}` keeps its default.

6. **Wire the two daily-note flows.** Both need the template *before* the
   resolver, since the pattern comes from it:

   - `daily-note-resolver.ts`: move the `loadTemplate` call (line 48) above
     `new Resolver(…)` (line 44). No behaviour change — same single load.
   - `daily-note-service.ts`: load the template eagerly instead of handing
     `NoteFactory` a lazy closure, and pass `loadTemplate: async () =>
     template`. `createNote` calls the hook exactly once, before anything else
     (`note-creation-flow.ts:116`), so awaiting it a few lines earlier is the
     same single load, with load errors still thrown out of
     `createDailyNoteIfNotExists`.

   Each then builds the pattern — `template.metadata?.get('filepath')` if
   present, otherwise the settings triple — and passes
   `date => { const uri = findPreviousDailyNote(foam.workspace, pattern, date); return uri && foam.workspace.getIdentifier(uri); }`.
   `getIdentifier` (`workspace.ts:341`) is what AC-5 asks for — the same
   minimal identifier wikilink completion produces, extension stripped.
   `template.metadata` comes from `TemplateLoader` (`template-loader.ts:73`),
   which parses the frontmatter *before* any variable resolution — that
   unresolved copy is the one to invert, not the resolved metadata the engine
   re-extracts at `note-creation-engine.ts:139`.

7. **Docs.** A row in the variable table in
   `docs/user/features/templates.md` (after `FOAM_CURRENT_DIR`, line 248) and a
   short daily-note-template example in
   `docs/user/features/daily-notes.md` showing `[[$FOAM_PREVIOUS_DAILY_NOTE]]`
   and the `${FOAM_PREVIOUS_DAILY_NOTE:no previous note}` fallback. State which
   patterns are supported — the daily note path has to spell out year, month
   and day in numbers — and that a path built from a month or day *name*
   leaves the variable unresolved, so the fallback shows instead.

8. **Changeset.** `@foam/core` minor, plus `foam-vscode` and `@foam/cli` patch —
   they bundle core at build time, so Changesets will not cascade the bump.

## AC verification map

- AC-1 (gaps skipped) → `packages/foam-core/src/templates/previous-daily-note.test.ts`
- AC-2 (`undefined` → template fallback used) → `packages/foam-core/src/templates/variable-resolver.test.ts`
- AC-3 (no fallback → empty, not literal `$FOAM_…`) → `packages/foam-core/src/templates/variable-resolver.test.ts`
- AC-4 (search anchored at the target date, not today) → `previous-daily-note.test.ts` (pass a `before` in the past and assert an earlier note wins over a later one)
- AC-5 (workspace identifier, no brackets or whitespace) → `variable-resolver.test.ts`, with the identifier itself covered in `previous-daily-note.test.ts`
- AC-6 (template without the variable → unchanged, lookup never called) → `variable-resolver.test.ts` with a spy callback
- AC-7 (years-old note still found) → `previous-daily-note.test.ts`
- Pattern inversion → `daily-note-path-pattern.test.ts`: the default template
  path (`/journal/${FOAM_DATE_YEAR}-…`), a `$FOAM_TITLE` path, a nested
  `${FOAM_DATE_YEAR}/${FOAM_DATE_MONTH}/…` path, an `isoDate` settings path, a
  relative pattern matched on a path suffix, a literal directory whose name
  contains format letters (`Documents/`) staying literal, a non-daily note in
  the same folder not matching, and the unavailable cases (month name, week
  number, year+month only) returning `undefined`.
- Wiring, VS Code → `packages/foam-vscode/src/vscode/features/daily-notes/daily-note-service.spec.ts`: create a daily note from a template containing the variable and assert the written content carries the link. Asserts the flow is connected, not the domain result.
- Wiring, CLI/core → a case in `packages/foam-core/src/templates/daily-note-resolver.test.ts`, which already builds a workspace via `createTestWorkspace`.

Core tests stub config with `Config.setDefaultConfig(…)`, as
`template-discovery.test.ts:20` does, and restore `DefaultFoamConfig` after.

## Decisions

- **How a daily note is recognized** (spec open question 2) → invert the
  daily-note path pattern, as above. The earlier draft of this plan used a
  heuristic — "basename starts with a date in `filenameFormat`" — which was
  wrong in both directions: it ignored the template `filepath` that actually
  writes the note, and it matched any note in the workspace that happened to
  start with a date. Inverting the pattern makes the definition that writes a
  daily note the one that reads it back, and confines false positives to notes
  that sit in the daily note's own folder *and* carry its exact filename shape.
- **Unsupported pattern → `undefined`, not a looser match.** A day name or a
  locale month name could be matched loosely (`[^/]+`) and the result verified
  by re-rendering the pattern forward for the parsed date. That is a real
  option if users hit the limit, but it needs the forward renderer and the
  resolver's locale in the lookup, and nothing asks for it yet.
- **`[[]]` in the first daily note of a workspace** (spec open question 1) →
  accept it, document the fallback form instead. AC-3 requires the bare
  variable to vanish; the brackets sit outside it and nothing at resolution time
  can reach them. Teaching `${FOAM_PREVIOUS_DAILY_NOTE:…}` in the docs costs
  nothing and the one-off empty-workspace case does not justify machinery.
- **The pattern is built by the two flows, not read from `Config` inside the
  lookup.** The template branch needs the loaded template, which only the
  flows have, so the settings branch sits next to it rather than in core's
  `Config`, and `findPreviousDailyNote` takes the pattern as a parameter. The
  parsing and inversion stay pure and are tested directly.
- **Callback instead of passing `FoamWorkspace` to `Resolver`** — see Approach.
  It also keeps the variable from silently appearing in `new-note` templates,
  which the spec puts out of scope.

## Risks

- **The pattern inversion is the part users will notice going wrong.** It is
  sound for the patterns Foam itself writes and documents, and every wrong
  answer it can give is either "no previous note" (pattern unsupported, or a
  daily note written under a different pattern in the past) or a note that
  matches the daily-note pattern exactly without being one. A workspace whose
  daily note path changed over time only sees the notes under the current
  pattern — that is a real limitation to state in the docs.
- **`foam daily` never sets `FOAM_TITLE`.** `daily.ts:83` calls
  `resolveDailyNote` without `variables`, so a template filepath using
  `$FOAM_TITLE` does not resolve there today — already broken, independent of
  this work, and out of scope. Inverting `FOAM_TITLE` as `YYYY-MM-DD` is
  correct for the VS Code flow and inert for the CLI.
- **Loading the template eagerly in `daily-note-service.ts`** moves the one
  load a few lines earlier. `daily-note-service.spec.ts` covers the template,
  no-template and untrusted paths; if the move is not behaviour-identical they
  fail.
- **Moving `convertDateformatToDayjs` out of `daily-note-service.ts` touches
  the filename/link/title formatting that every daily note goes through.**
  `daily-note-service.spec.ts` and
  `packages/foam-vscode/src/daily-note/daily-note-snippets.test.ts` are the
  safety net.
- **The variable resolves during filepath resolution too.** A template whose
  `foam_template.filepath` contains `$FOAM_PREVIOUS_DAILY_NOTE` would put an
  identifier — possibly with a `/` — into a path, and that path would then be
  inverted against a pattern containing an uninvertible variable, so the
  feature would report itself unavailable. Self-limiting, and no worse than
  the other variables. Not worth guarding; worth knowing.
- **`workspace.list()` on every resolution.** One array scan per daily note
  created, in memory, only when the template names the variable. Not worth
  caching, and a cache would have to be invalidated on every workspace change.
