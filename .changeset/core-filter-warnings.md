---
'@foam/core': minor
---

`parseFilter` and `executeQuery` now return parse-time warnings alongside their primary result, so callers can surface filter problems (rejected regex, unresolved link target, Jexl compile error, deprecated `expression` field) to users instead of leaving them in the log. `parseFilter` returns `FilterResult` (`{ predicate, warnings }`); `executeQuery` returns `QueryExecutionResult` (`{ results, warnings }`). Markdown preview now renders these warnings above query results. `QueryResult.toArray()` (the fluent JS-query API) is unchanged.
