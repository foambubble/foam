---
'@foam/core': patch
---

Replace the `eval()`-backed `expression` query filter with a sandboxed `jexl` filter. The `expression` field is deprecated and no longer evaluated — queries using it now match nothing and log a warning. Migrate by renaming to `jexl` and adapting the syntax (e.g. `resource.tags.length > 2` becomes `resource.tags|length > 2`, `===` becomes `==`). Resolves EVAL-1 from the 2026-05-11 security audit.
