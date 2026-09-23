---
'@foam/core': minor
'foam-vscode': patch
'@foam/cli': patch
---

New `FOAM_PREVIOUS_DAILY_NOTE` template variable: in a daily note template it
expands to the identifier of the most recent daily note that exists before the
one being created, skipping gaps like weekends, so
`[[$FOAM_PREVIOUS_DAILY_NOTE]]` links to it and
`${FOAM_PREVIOUS_DAILY_NOTE:nothing yet}` supplies a fallback for the first
daily note. It only works when the daily note path spells out year, month and
day in numbers (#1706).
