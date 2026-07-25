# Issue #1675: does not respect `workbench.editorAssociations` in VS Code user settings

- **Link**: https://github.com/foambubble/foam/issues/1675
- **Reporter**: @bigheadghost (win10 x64, VS Code 1.126–1.127)
- **State**: closed as completed (2026-07-12) — **but reporter confirmed on 2026-07-13 that the bug persists in Foam v0.44.2**, which *does* contain the shipped fix (commit `0c25941`, released in 0.44.2 per CHANGELOG). The issue likely needs to be reopened.

## Summary

With `workbench.editorAssociations` set in **user** settings (e.g. `"*.jpg": "default"`), ctrl+clicking a link to that file type in a Foam workspace opens the file in the wrong editor (e.g. the built-in image `previewEditor` instead of the configured one). The same setting placed in **workspace** `.vscode/settings.json` works. With the Foam extension disabled, the user-level setting works too — so Foam's link-opening path is the differentiator.

Reporter's minimal repro (post-fix, v0.44.2):

```markdown
[test](a.jpg)
```

User settings:

```json
"workbench.settings.applyToAllProfiles": ["workbench.editorAssociations"],
"workbench.editorAssociations": { "*.jpg": "default" }
```

- Foam disabled → ctrl+click opens `a.jpg` with `default` (correct; handled by the built-in Markdown extension).
- Foam enabled → ctrl+click opens `a.jpg` with `previewEditor` (wrong).
- Foam enabled + same setting copied to workspace settings → correct.

Note the reporter uses VS Code profiles (`applyToAllProfiles` is set) — relevant, see Root Cause Analysis.

## Timeline

1. 2026-07-01 — issue opened (originally about `*.pdf`).
2. 2026-07-12 — commit `0c25941` "Honor workbench.editorAssociations for attachment links (fix #1675)" lands; issue closed; shipped in foam-vscode **0.44.2**.
3. 2026-07-13 — reporter re-tests on 0.44.2 and confirms the bug **still remains** for regular markdown links to images.

## Research Findings

### What the shipped fix (`0c25941`) did

In `packages/foam-vscode/src/vscode/features/navigation/navigation-provider.ts`:

1. `provideDefinition` (line ~208–217): returns early (no Definition) when the resolved target resource is of type `attachment` or `image`. This removes the "Go to Definition" text-editor pipeline for those targets.
2. `provideDocumentLinks` (line ~283–298): emits a `vscode.DocumentLink` whose **target is the plain `file:` URI** of the attachment/image (`toVsCodeUri(o.target.asPlain())`), for non-external, non-reference, non-placeholder links (both wikilinks and regular markdown links).

Tests added in `navigation-provider.spec.ts` (lines 374–460, "attachment and image navigation") assert exactly this shape: 1 DocumentLink with a plain file URI target, no definitions. The spec is **not** `@unit-ready` (runs under `yarn test` / e2e only).

### Why the fix is insufficient — how VS Code opens the two kinds of links

The fix's comment assumes "clicks route through VS Code's URI-opening pipeline (which honors `workbench.editorAssociations`)". That assumption is only partially true — the two pipelines differ:

- **Built-in Markdown extension** (the path that works when Foam is disabled): its DocumentLink target is a **command URI** (`_markdown.openDocumentLink`), whose handler ultimately runs `vscode.commands.executeCommand('vscode.open', uri, {...})` (see `extensions/markdown-language-features/src/util/openDocumentLink.ts`). The `vscode.open` API command goes through `editorService.openEditor` with an untyped input → full **editor resolver** → honors `workbench.editorAssociations` at every scope.
- **Plain-URI DocumentLink** (what Foam now emits): clicking routes through the editor's link detector → `IOpenerService.open` → `EditorOpener` in `src/vs/editor/browser/services/openerService.ts`, which calls **`editorService.openCodeEditor({resource, ...})`** — a different entry point intended for code editors. Empirically (reporter's test matrix) this path picks up **workspace-scope** associations but not the **user/profile-scope** ones propagated via `applyToAllProfiles`.

Additionally, because Foam's DocumentLink range covers the whole `[test](a.jpg)` link (starting before the built-in Markdown link, which covers only the destination), VS Code's link merging drops the overlapping built-in link — so **Foam's link shadows the built-in one that worked correctly**. Net effect of the 0.44.2 fix for regular markdown links: it swapped one broken pipeline (Go to Definition) for another subtly-broken one (plain-URI DocumentLink), while also disabling the built-in behavior that was previously fine for `[text](file.jpg)` links.

There are several long-standing VS Code issues about `editorAssociations` resolution being inconsistent across open paths and about `applyToAllProfiles` propagation (e.g. microsoft/vscode#117451, #137675, #190227), which explains the user-vs-workspace scope asymmetry the reporter sees. Foam cannot fix VS Code, but it can route opens through the one pipeline that demonstrably respects the setting: the `vscode.open` command.

### Relevant code

| File | Role |
| --- | --- |
| `packages/foam-vscode/src/vscode/features/navigation/navigation-provider.ts` | Definition + DocumentLink providers; contains the 0.44.2 attachment/image handling (lines ~208–217 and ~280–298) |
| `packages/foam-vscode/src/vscode/features/navigation/navigation-provider.spec.ts` | Tests for the current behavior (lines 374–460) — will need updating |
| `packages/foam-vscode/src/vscode/utils/commands.ts` | `commandAsURI()` — already used to build command-URI DocumentLinks for placeholders and tags |
| `packages/foam-core/src/services/attachment-provider.ts` | Classifies resources as `image` vs `attachment` |

## Root Cause Analysis

1. **Primary**: Foam emits attachment/image DocumentLinks with a plain `file:` URI target. VS Code opens those via `openerService`/`openCodeEditor`, which does not resolve `workbench.editorAssociations` the same way as the `vscode.open` command — user-level (profile-propagated) associations are ignored, workspace-level ones happen to work.
2. **Secondary**: Foam's DocumentLink overlaps and shadows the built-in Markdown extension's link for regular `[text](file.ext)` links, replacing a correct open path with a broken one.
3. **Environmental**: VS Code's `applyToAllProfiles` + `editorAssociations` handling has known inconsistencies, which is why the failure only shows at user scope. Foam should sidestep it by using `vscode.open`.

## Solution Approaches (ranked)

### Approach 1 (preferred): open attachments/images via a `vscode.open` command URI

Change `attachmentLinks` in `provideDocumentLinks` to emit a **command URI** target instead of a plain file URI, mirroring what the built-in Markdown extension does:

```ts
const dl = new vscode.DocumentLink(
  toVsCodeRange(o.link.range),
  commandAsURI({ name: 'vscode.open', params: [toVsCodeUri(o.target.asPlain())] })
);
```

(Verify `Uri` serialization through `commandAsURI` — VS Code revives `{$mid: 1, ...}` JSON back into `Uri` for command arguments; if it doesn't round-trip cleanly, register a tiny `foam-vscode.open-attachment` command that takes a path/URI string and calls `vscode.open`.)

Consider applying the same treatment to `resolvedReferenceLinks` whose target is an attachment/image, since they share the plain-URI mechanism.

- **Pros**: routes through the exact pipeline proven to respect user-level `editorAssociations` (the foam-disabled test case); fixes wikilinks and regular markdown links uniformly; small, localized diff; Foam already uses command-URI DocumentLinks (placeholders, tags).
- **Cons**: DocumentLink target is no longer the file URI (hover/tooltip still controllable via `dl.tooltip`, already set); tests asserting `links[0].target === toVsCodeUri(pdf.uri)` must be updated to assert the command URI; command URIs require `allowCommands` in some contexts (fine for editor DocumentLinks).

### Approach 2: defer regular markdown links to the built-in Markdown extension

For `o.link.type === 'link'` (regular markdown links, non-reference), **emit no Foam DocumentLink at all** (keep the Definition suppression from 0.44.2). The built-in Markdown extension already provides a correct link for `[text](a.jpg)` — with Foam's overlapping link gone, it is no longer shadowed and opens via `vscode.open`. Keep Foam DocumentLinks only for wikilinks (`[[file.pdf]]`), which the built-in extension does not handle — ideally combined with the command-URI target from Approach 1 for those.

- **Pros**: removes duplication with the built-in provider; smallest possible Foam footprint for standard markdown syntax; reporter's exact repro is fixed by definition (identical to the foam-disabled behavior).
- **Cons**: does not by itself fix the wikilink→attachment case (still needs Approach 1's mechanism there, so it is a complement rather than a full alternative); depends on the built-in Markdown extension's presence/behavior (safe in practice, but it means Foam's tests can't fully assert the end-to-end behavior); needs verification that removing Foam's link doesn't regress fragment handling (`[x](doc.pdf#page=3)`-style links) or the #1379 extensionless-file handling.

**Recommendation**: Approach 1, optionally with Approach 2's deferral for regular markdown links as a follow-up simplification.

## Technical Considerations

- **Reopen the issue**: the fix shipped in 0.44.2 and the reporter reproduced the bug on 0.44.2; the close was premature.
- **Testing**: `navigation-provider.spec.ts` is an e2e spec (no `@unit-ready` marker) — run with `yarn test` from `packages/foam-vscode`. Per project workflow, first update the three "attachment and image navigation" tests to expect the command-URI target and watch them fail, then implement.
- **Manual verification matrix** (mirrors reporter's): user-level-only setting, workspace-level-only setting, both, and with a non-default VS Code profile + `applyToAllProfiles` — for `[text](a.jpg)`, `[[a.jpg]]`, and a `.pdf` attachment.
- **`vscode.open` args via command URI**: query must decode to an *array* of arguments; `commandAsURI` JSON-encodes `command.params`, so pass `params: [uri]` (array), matching the existing tags-explorer usage.
- **Windows**: reporter is on win10 — check drive-letter casing in the URI round-trip if the command-URI approach misbehaves there.
- **No `@foam/core` changes needed** — this is entirely in the VS Code layer, so no multi-package changeset cascade; a `foam-vscode` patch changeset suffices.

## References

- Fix commit: `0c2594157cdbd84e98ecd2f699586217af74727c`
- Built-in markdown open path: `extensions/markdown-language-features/src/util/openDocumentLink.ts` (uses `vscode.open`)
- Plain-URI link open path: `src/vs/editor/browser/services/openerService.ts` (`EditorOpener` → `openCodeEditor`)
- VS Code issues on editorAssociations/profile inconsistencies: microsoft/vscode#117451, microsoft/vscode#137675, microsoft/vscode#190227
- Related prior Foam work: #724 (definitions vs links design), #1379 (extensionless direct-path links)
