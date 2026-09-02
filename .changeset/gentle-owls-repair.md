---
'@foam/core': patch
'foam-vscode': patch
'@foam/cli': patch
---

Correctness and lifecycle fixes from the core model review:

- Files whose names differ only by case no longer overwrite each other in the
  workspace index (silent data loss on case-sensitive filesystems)
- The incremental graph now re-resolves links that a newly added note wins by
  identifier or directory-index priority, staying equivalent to a full rebuild
- Rename edits can no longer corrupt files: duplicate definition edits are
  deduplicated, partially overlapping edits are rejected, and a single
  unparsable link skips that link instead of aborting the rename
- Tag ranges are computed correctly for frontmatter tags that are substrings
  of other tags and for hashtags on continuation lines of multi-line
  paragraphs; quoted "tags" frontmatter keys are recognized
- Published static-site graph JSON no longer includes raw note frontmatter,
  only allowlisted presentation keys (color, type)
- Uppercase attachment extensions (photo.PNG) are classified like their
  lowercase counterparts; rapid successive changes to one file can no longer
  leave stale content in the workspace; disposal no longer leaks FoamTags,
  resource providers, or graph-webview registrations; one failing feature no
  longer aborts the whole extension activation
