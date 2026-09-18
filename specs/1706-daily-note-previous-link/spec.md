---
issue: 1706
type: feature
status: draft
created: 2026-09-18
---

# Link a daily note to the previous one

## Context

[Issue #1706](https://github.com/foambubble/foam/issues/1706) describes a
common morning workflow: open today's daily note, jump to the previous one
with `/yesterday` (or `/-friday`), and carry over unfinished tasks. That
breaks down after any gap in daily notes — a weekend, a holiday, a few days
off — because `/yesterday` always resolves to the calendar day before, not
the last note that was actually written. The reporter wants the daily note
template to link to that last real note directly, without needing a
JavaScript template. Two earlier requests, [#930](https://github.com/foambubble/foam/issues/930)
and [#931](https://github.com/foambubble/foam/issues/931), asked for the
same thing and were closed as out of scope for Foam core at the time;
Foam's Markdown template variable system (`FOAM_DATE_*`, `FOAM_CURRENT_DIR`,
etc., see [[templates]]) now makes it possible to offer this as a variable
rather than a snippet or a scripting feature.

This spec covers a new Foam template variable, `FOAM_PREVIOUS_DAILY_NOTE`,
resolved when a daily note is created. It expands to the identifier of the
most recent daily note that exists in the workspace before the note being
created — skipping any gaps — so a template writes
`[[$FOAM_PREVIOUS_DAILY_NOTE]]` to get a link, or uses the bare value for
anything else. When no earlier daily note exists the variable does not
resolve, which lets a template supply its own fallback with the standard
`${FOAM_PREVIOUS_DAILY_NOTE:...}` syntax.

## Acceptance criteria

- **AC-1**: Given daily notes exist for Monday and last Friday, but not for
  the Saturday, Sunday or Tuesday in between, when a daily note is created
  for Wednesday and its template contains `$FOAM_PREVIOUS_DAILY_NOTE`, then
  the variable resolves to the identifier of Monday's note (the most recent
  one), not Friday's or Tuesday's (which does not exist).
  _verify: unit_

- **AC-2**: Given no daily note exists anywhere in the workspace yet, when
  the first daily note is created from a template containing
  `${FOAM_PREVIOUS_DAILY_NOTE:no previous note}`, then the template's
  fallback text is used — i.e. the variable resolves to `undefined` rather
  than to an empty string, so the existing snippet default mechanism
  applies.
  _verify: unit_

- **AC-3**: Given the same empty workspace, when the template writes
  `$FOAM_PREVIOUS_DAILY_NOTE` with no fallback, then the variable expands
  to nothing rather than being left in the note as literal `$FOAM_...`
  text.
  _verify: unit_

- **AC-4**: Given a daily note is created for a relative date (e.g. via the
  `/tomorrow` or `/-friday` snippet, so the target date is not the current
  real-world date), when its template resolves
  `$FOAM_PREVIOUS_DAILY_NOTE`, then the search for the previous note starts
  from that target date, not from today.
  _verify: unit_

- **AC-5**: Given a previous daily note exists, when
  `$FOAM_PREVIOUS_DAILY_NOTE` resolves, then the value is that note's
  workspace identifier — the same one Foam uses elsewhere for wikilinks —
  and not a raw or absolute path, so a template that wraps it in `[[...]]`
  produces a link that participates in the graph and backlinks. The
  variable itself contributes no brackets, no link syntax and no
  surrounding whitespace.
  _verify: unit_

- **AC-6**: Given a daily note template that does not reference
  `$FOAM_PREVIOUS_DAILY_NOTE`, when a daily note is created, then behaviour
  is unchanged — no automatic lookup or content is added on the caller's
  behalf.
  _verify: unit_

- **AC-7**: Given the most recent daily note is years older than the note
  being created, when `$FOAM_PREVIOUS_DAILY_NOTE` resolves, then it is
  still found — the search is bounded by the daily notes present in the
  workspace, not by a fixed time window.
  _verify: unit_

## Out of scope

- Copying or summarizing content (e.g. an open-tasks section) from the
  previous note into the new one — that's the JavaScript-template use case
  from #931, and this variable only produces a link target.
- Changing `/yesterday`, `/-friday`, or the other day-of-week snippets —
  they keep resolving calendar-relative dates regardless of which notes
  exist.
- A command or UI affordance to jump to the previous note from an
  already-created daily note; this is a template-resolution-time variable
  only.
- Making the variable available outside the daily-note creation flow (e.g.
  in the default `new-note` template), since it depends on the note's
  `foamDate`.

## Open questions

- With the variable expanding to an identifier, a template that writes
  `[[$FOAM_PREVIOUS_DAILY_NOTE]]` renders `[[]]` in the very first daily
  note of a workspace (AC-3). A fallback can't help there, because the
  brackets sit outside the variable. Options: accept the wart, or document
  usage patterns that degrade cleanly. Not a blocker for AC-1..AC-7.
- How a daily note is recognized when the template's `filepath` metadata
  puts notes somewhere other than `openDailyNote.directory` — the search
  has to identify candidates either by enumerating workspace resources and
  matching the filename format, or by computing the expected path per
  date. This determines whether AC-7 is naturally satisfied. Left for
  `plan.md`.

[templates]: ../../docs/user/features/templates.md 'Note Templates'
