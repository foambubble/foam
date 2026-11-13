---
issue: 1626
type: feature
created: 2026-11-13
---

# Query typed links between notes

Foam users want to distinguish relationships between notes so they can ask which notes replace or depend on another note.

- AC-1. Notes can declare named, directed relations to other notes. Queries can filter by relationship and direction. Verification uses unit tests.
- AC-2. Editing, adding or deleting a note updates relationship results. Verification uses unit tests.
- AC-3. Invalid entries and missing targets leave existing link queries usable. Verification uses unit tests.
