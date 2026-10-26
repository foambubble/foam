---
issue: 1754
type: feature
created: 2026-10-26
---

# Offer the lezer markdown parser as an opt-in

## Context

[Issue #1754](https://github.com/foambubble/foam/issues/1754) reports that
`remark-parse` 8 takes time quadratic in the size of a single list, not in the
size of the note. A 72,000-line note is 11.8 s as one unbroken outline and
1.7 s with a heading every 60 lines; the blow-up starts above roughly 8,000
lines in one list. Where it shows it costs workspace load and makes typing lag,
because every edit re-parses the note — about 256 ms at 8,000 lines. The
benchmark in `markdown-parser.bench.ts` already tracks both shapes and its
comment records the same finding: the outline group is deliberately left out of
the `[linear]` scaling gate because remark really is superlinear there.

The issue's research rules out staying on remark (every generation is as bad or
worse on lists) and rules out the faster parsers that report block positions
only, because Foam builds a `Range` for every link, tag, heading and block
anchor. `@lezer/markdown` is linear, reports inline offsets, and ships CommonJS,
and a prototype on `perf/lezer-parser` implements `ResourceParser` against a
shared conformance suite. The issue asks for it behind a setting first, so it
runs on real workspaces before becoming the default — **this spec is that
stage, and it does not change what any existing user gets.** Flipping the
default and deleting remark is the follow-up.

The issue also says this is not a priority: few notes are one long list, and the
saved parse cache makes repeat parses of an unchanged note nearly free. Nothing
here argues otherwise. What the stage buys is that the swap becomes a
configuration change rather than a rewrite, at the moment one of the issue's
triggers fires.

Three things have moved since the prototype. `main` reads tasks into `Resource`
(`ac39ff48`, `f339d8fc`), which the prototype predates and its conformance
suite does not cover. `getBlockFor` and `getLinkDefinitions` are public exports
that run their own `remark` instance outside `ResourceParser`, so no parity test
reaches them — `tree-view-utils.ts` and `lint/generate-link-references.ts` are
the callers. And `ParserPlugin`'s `extraPlugins` seam is remark-shaped: it hands
a plugin a `unist` `Node` and a `unified.Processor`, which lezer has no
equivalent for. Nothing in the repo passes an extra plugin.

## Acceptance criteria

- **AC-1**: Given one conformance suite that both parsers are run against, when
  `yarn test:unit` runs, then the suite covers everything
  `markdown-parser.test.ts` covers on `main` today — block anchors, sections,
  wikilink aliases and embeds, footnotes, frontmatter tag ranges, reference
  links, and tasks with their statuses and day links — and both the remark and
  the lezer parser pass it.
  _verify: unit_

- **AC-2**: Given a note where the two parsers disagree, when each parses it,
  then the difference is pinned by a parser-specific test naming the parser:
  lezer does not read a `#hashtag` inside inline code, a fenced code block or a
  link target as a tag, and remark does. No other divergence exists; any found
  while building this is either fixed or added here.
  _verify: unit_

- **AC-3**: Given the new setting is unset or absent, when the extension loads a
  workspace, then it parses with remark exactly as it does today — same
  `Resource` for every note, same saved cache entries reused across a restart.
  _verify: unit_

- **AC-4**: Given the setting selects the lezer parser, when the extension loads
  a workspace, then every Foam feature that reads a `Resource` works unchanged:
  the graph, Connections and Tags panels, backlinks, wikilink completion, hover,
  embeds in the preview, link syncing on rename, and `foam lint`.
  _verify: e2e_

- **AC-5**: Given a workspace loaded and cached with one parser, when the
  setting is changed to the other and the workspace is loaded again, then no
  note is served from a cache entry the other parser wrote.
  _verify: unit_

- **AC-6**: Given `getBlockFor` and `getLinkDefinitions`, when `yarn test:unit`
  runs, then tests pin their current behaviour — the list-item and heading block
  shapes the tree views rely on, and the definitions
  `generate-link-references.ts` reads, footnote definitions excluded.
  _verify: unit_

- **AC-7**: Given `createMarkdownParser`, when this ships, then its
  `extraPlugins` parameter and the `ParserPlugin` type are gone from
  `@foam/core`, nothing in the repo passes extra plugins, and the removal is
  listed as a breaking `@foam/core` change for the release notes.
  _verify: unit_

- **AC-8**: Given the unbroken-outline shape from 2,000 to 16,000 lines, when
  `yarn workspace @foam/core bench` runs in A/B mode with both parsers, then
  lezer's parse time roughly doubles when the note size doubles — where remark's
  grows 2.3-2.8x per doubling, as the bench comment records — and lezer is at
  least 4x faster at 8,000 lines. With the A/B entry removed, the committed
  single-candidate groups and names are unchanged, so CI's baseline gate still
  applies.
  _verify: human_ (the bench is not part of the test suites; the A/B run is
  recorded on the PR)

## Out of scope

- **Making lezer the default, and removing `remark-parse`.** The issue asks for
  the setting first. That follow-up is also where the bench's outline group gets
  its `[linear]` tag — its comment says "once a parser that actually is linear
  on this shape becomes the default" — and where `getBlockFor` and
  `getLinkDefinitions` move off remark. Until then both parsers are maintained
  and the remark dependency stays, including for those two functions whichever
  parser the setting selects.
- **Incremental re-parsing.** Lezer can reuse the previous tree — 1 ms instead
  of 144 ms on a 1.3 MiB note after one keystroke — but Foam's own pass over the
  tree is about 20% of a parse and is not incremental, capping the win at ~5x,
  and collecting it means keeping a tree per open document. Separate work, worth
  doing only if typing cost in long notes becomes the complaint.
- **A lezer replacement for the `ParserPlugin` hook.** AC-7 removes the seam
  rather than re-cutting it for a second parser. If an extension point is wanted
  later it can be designed against whichever parser has won.
- **The module-level processor and `sectionStack` state** that
  `docs/dev/design/core-model-and-api-review.md` flags — a pre-existing problem
  in the remark parser, not caused or fixed here.

## Open questions

- **Removing `ParserPlugin` versus giving lezer its own hook.** AC-7 removes it.
  It is exported from the `@foam/core` barrel, so an out-of-tree consumer could
  in principle be using it, but nothing in this repo passes extra plugins, the
  API review already calls it a seam with "few implementors", and keeping it
  would mean either freezing the remark parser as the only pluggable one or
  inventing a lezer hook with no caller to shape it. I would have asked whether
  any known consumer passes plugins; assuming none until told otherwise.
- **Whether the setting should be `foam.experimental`-gated or its own key.**
  `foam.experimental` today bundles the AI features and HTML export, which a
  user who wants a faster parser has no reason to enable. Assuming a dedicated
  key, described as experimental and documented as removable once the default
  flips, and not mentioned in the user docs until it is the default.
