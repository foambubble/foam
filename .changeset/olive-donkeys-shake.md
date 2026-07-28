---
'@foam/core': patch
'foam-vscode': patch
'@foam/cli': patch
---

Added a workspace load report to help diagnose slow startups (#1689). The Foam
output log now breaks the load time down into file reads, markdown parsing and
unaccounted time, along with parser cache hit rate, extension host event loop
lag, and the slowest notes to parse.
