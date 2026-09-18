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
resolved when a daily note is created. It expands to a wikilink to the most
recent daily note that exists in the workspace before the note being
created — skipping any gaps — or to nothing if none exists yet.

## Acceptance criteria

- **AC-1**: Given daily notes exist for Monday and last Friday, but not for
  the Saturday, Sunday or Tuesday in between, when a daily note is created
  for Wednesday and its template contains `$FOAM_PREVIOUS_DAILY_NOTE`, then
  the resolved content links to Monday's note (the most recent one), not
  Friday's or Tuesday's (which does not exist).
  _verify: unit_

- **AC-2**: Given no daily note exists anywhere in the workspace yet, when
  the first daily note is created with `$FOAM_PREVIOUS_DAILY_NOTE` in its
  template, then the variable resolves to an empty string rather than a
  broken or placeholder link.
  _verify: unit_

- **AC-3**: Given a daily note is created for a relative date (e.g. via the
  `/tomorrow` or `/-friday` snippet, so the target date is not the current
  real-world date), when its template resolves
  `$FOAM_PREVIOUS_DAILY_NOTE`, then the search for the previous note starts
  from that target date, not from today.
  _verify: unit_

- **AC-4**: Given a previous daily note exists, when
  `$FOAM_PREVIOUS_DAILY_NOTE` resolves, then the result is a standard Foam
  wikilink using that note's identifier, so it participates in the graph
  and backlinks like any other link (as opposed to a raw path or a link
  that only resolves via the daily-note snippets).
  _verify: unit_

- **AC-5**: Given a daily note template that does not reference
  `$FOAM_PREVIOUS_DAILY_NOTE`, when a daily note is created, then behaviour
  is unchanged — no automatic lookup or content is added on the caller's
  behalf.
  _verify: unit_

## Out of scope

- Copying or summarizing content (e.g. an open-tasks section) from the
  previous note into the new one — that's the JavaScript-template use case
  from #931, and this variable only produces a link.
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

- How far back should the search look before giving up on a workspace that
  has no earlier daily note at all (AC-2 covers the empty-workspace case,
  but a workspace with a daily note from years ago and a large gap needs a
  bound so the lookup doesn't scan indefinitely)? I'd default to a fixed,
  generous lookback (e.g. a year) rather than exposing a new setting,
  since nothing in the issue asks for tuning this. Left for `plan.md`.
- Exact wikilink format when the previous note lives in a differently
  named or nested path (per the `filepath` template metadata in
  [[templates]]) — assumed to use the same identifier resolution as other
  Foam-generated links (e.g. `/yesterday`), so no special-casing is needed,
  but not verified against a nested-path example.

[templates]: ../../docs/user/features/templates.md 'Note Templates'
