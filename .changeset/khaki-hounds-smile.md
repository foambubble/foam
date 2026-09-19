---
'@foam/core': minor
'foam-vscode': patch
'@foam/cli': patch
---

New `FOAM_PREVIOUS_DAILY_NOTE` template variable: in a daily note template it
expands to the most recent daily note that exists before the one being
created, skipping gaps like weekends and holidays. It resolves to the note's
identifier, so `[[$FOAM_PREVIOUS_DAILY_NOTE]]` is an ordinary wikilink and
`${FOAM_PREVIOUS_DAILY_NOTE:nothing yet}` supplies a fallback for the first
daily note of a workspace.

Daily notes are recognized by inverting the path the daily note template
creates them at, so the search is bounded by the notes that exist rather than
by a fixed number of days. A path that does not spell out year, month and day
in numbers cannot be read back, and the variable stays unresolved there.
