---
type: feature
status: draft
created: 2026-09-21
---

# Tab stops in JavaScript templates

## Context

A user on Discord spent two days working out how to put a VS Code tab stop
into a JavaScript template. They eventually found the answer themselves:
write `` `- \$\{1\}` `` inside the backtick string.

Nothing in Foam was broken. A JS template's `content` is inserted with
`new SnippetString(content)` (`note-factory.ts`), and the Foam resolver
deliberately leaves non-Foam snippet syntax alone — an existing test
(`note-creation-engine.test.ts:275`) asserts that `${1:foo} $2` comes back
unchanged from a JS template. The collision is a JavaScript one: template
literals use `${...}` for interpolation, so an unescaped tab stop is
evaluated as JS before Foam ever sees it.

Two gaps made this cost two days:

1. `docs/user/features/templates.md` never mentions tab stops at all — not
   for Markdown templates, not for JavaScript ones. There was nothing to
   read.
2. When a template interpolates a value it computed (a note title, a
   filename, a line pulled from another note), any `$`, `}` or `\` in that
   value is snippet syntax by the time VS Code parses the content. A title
   like `Budget: $5 left` inserts a stray tab stop. A template author has no
   supported way to escape it — `SnippetParser.escape` exists in
   `packages/foam-core/src/common/snippetParser.ts` but is not reachable from
   the template sandbox.

Gap 1 is the reported pain and is pure documentation. Gap 2 is a silent
correctness problem that documentation cannot fix.

## Acceptance criteria

- **AC-1**: Given the JavaScript Templates section of
  `docs/user/features/templates.md`, when a reader looks for tab stops, then
  they find that tab stops and placeholders work in template content, and a
  working example of the backtick escaping (`` `- \${1}` ``) with a sentence
  saying the escape is required by JavaScript template literals, not by Foam.
  _verify: human_

- **AC-2**: Given the Markdown templates section of the same document, when a
  reader looks for tab stops, then they find that VS Code tab stops
  (`$1`, `${1:default}`, `${1|a,b|}`) can be used and need no escaping there.
  _verify: human_

- **AC-3**: Given the same document, when a reader uses templates outside the
  VS Code editor, then they find a note that the `foam` CLI and the MCP server
  write content to disk as-is, so tab stops appear literally in the created
  file — there is no editor to consume them.
  _verify: human_

- **AC-4**: Given a JavaScript template that calls `escapeSnippet(value)` on a
  string containing `$`, `}` or `\`, when the note is created, then those
  characters appear literally in the note and are not interpreted as snippet
  syntax.
  _verify: unit_

- **AC-5**: Given a JavaScript template that calls `escapeSnippet` on a string
  containing no snippet metacharacters, when the note is created, then the
  string is unchanged.
  _verify: unit_

- **AC-6**: Given a JavaScript template that calls `escapeSnippet`, when it
  runs under the `foam` CLI, then the function is available there too — the
  template sandbox exposes the same globals in every Node host.
  _verify: unit_

- **AC-7**: Given `docs/user/features/templates.md`, when a reader reaches the
  JavaScript template API surface, then `escapeSnippet` is listed alongside
  `dayjs`, `slugify` and `URI`, with an example of interpolating a computed
  title safely.
  _verify: human_

## Out of scope

- **A `tabstop(n, default)` helper.** It was the obvious candidate and it does
  not earn its place: `` `- ${tabstop(1)}` `` is longer than
  `` `- \${1}` ``, and it adds an API to work around a JavaScript language
  feature rather than a Foam one. AC-1 covers the same ground for free. If
  people keep hitting it after the docs land, it can be added then.

- **Escaping dynamic content in Markdown templates.** The same hazard exists
  there — `$FOAM_TITLE` resolving to a title with a `$` in it produces stray
  snippet syntax — but a Markdown template author has no code to call, so the
  fix would have to be automatic escaping inside the resolver. That is a
  behaviour change with its own compatibility question (templates that
  deliberately build snippet syntax out of variables) and belongs in its own
  spec.

- **Making the CLI or MCP strip or resolve tab stops.** AC-3 documents the
  current behaviour; changing it is a separate decision.

## Open questions

- **Is `escapeSnippet` worth shipping alongside the docs, or should this be a
  docs-only change?** My answer: ship it. It is about fifteen lines
  delegating to an escape function core already has, and it fixes something
  a user cannot work around from inside a template without hand-rolling the
  same regex. But it is not what was asked for, and dropping AC-4 to AC-7
  leaves a coherent docs-only spec.

- **Should the reported workaround be documented as `\${1}` or as the
  `\$\{1\}` the user landed on?** My answer: `\${1}`. Only the `$` needs
  escaping; `\{` and `\}` are no-op escapes that happen to work. Documenting
  the minimal form is clearer, and the fuller form keeps working for anyone
  who already wrote it.
