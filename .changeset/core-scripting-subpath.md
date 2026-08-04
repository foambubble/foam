---
'@foam/core': minor
'foam-vscode': patch
'@foam/cli': patch
---

Make the `@foam/core` barrel bundler-safe for non-Node runtimes (browsers,
React Native):

- The exports that execute user-supplied JavaScript via Node's `vm` —
  `TemplateLoader`, `resolveDailyNote`, `noteCreate`, `renderJsQuery` — moved
  out of the main barrel to the new **`@foam/core/scripting`** subpath
  (published as `foam-core/scripting`). Migration: change the import
  specifier; the APIs are unchanged.
- Platform detection rewritten as a pure, tested `detectPlatform()`
  (exported, along with `isReactNative`). Fixes Node ≥ 21 being misclassified
  as web (Node now ships a global `navigator`). The previously exported but
  unused `isIOS`, `locale`, `Platform`, `Language`, `translationsConfigFile`,
  `isElectronSandboxed` and `globals` are removed.
- `stripFrontMatter` no longer uses gray-matter, which requires Node's
  `Buffer` at call time. Behavior change: an unclosed opening `---` delimiter
  is no longer treated as frontmatter (gray-matter would swallow the whole
  document).
- New portability gate in the build: the public barrel must type-check with
  no Node and no DOM types (`tsconfig.portability.json`).

`foam-vscode` and `@foam/cli` are bumped because they bundle `@foam/core`.
