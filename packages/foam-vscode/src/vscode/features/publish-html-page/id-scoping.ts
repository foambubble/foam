/*global markdownit:readonly*/

import { toSlug } from '@foam/core';

/**
 * Installs renderer overrides that scope every `id` attribute inside a note's
 * rendered body to `note-<noteSlug>--<slug(originalId)>`.
 *
 * The report flattens many notes into one HTML document, so any id that
 * survives unmodified would either:
 *   - collide with the same id in another note, or
 *   - silently break cross-note `[link](note.md#id)` references that the
 *     link-rewriter already prefixes with `note-<slug>--`.
 *
 * Two sources of ids are handled by a single rule — "every id in note X
 * becomes `note-X--<slug(id)>`":
 *
 *   1. Headings emitted by markdown-it (`renderer.rules.heading_open`). The id
 *      is derived from the heading text.
 *
 *   2. Raw HTML the author wrote (`renderer.rules.html_inline` /
 *      `html_block`). Both `<a id="hello">` and `<div id='My Anchor'>` shapes
 *      are rewritten in place.
 *
 * `getCurrentNoteSlug` is read on each render so the same `md` instance can
 * render multiple notes back-to-back without re-installation.
 */
export function installIdScoping(
  md: markdownit,
  getCurrentNoteSlug: () => string | null
): void {
  installHeadingIds(md, getCurrentNoteSlug);
  installRawHtmlIdRewrite(md, getCurrentNoteSlug);
}

function installHeadingIds(
  md: markdownit,
  getCurrentNoteSlug: () => string | null
): void {
  const original =
    md.renderer.rules.heading_open ??
    function (tokens: any, idx: any, options: any, _env: any, self: any) {
      return self.renderToken(tokens, idx, options);
    };

  md.renderer.rules.heading_open = function (
    tokens: any,
    idx: any,
    options: any,
    env: any,
    self: any
  ) {
    const noteSlug = getCurrentNoteSlug();
    if (!noteSlug) {
      return original(tokens, idx, options, env, self);
    }
    const inline = tokens[idx + 1];
    const headingText: string =
      inline && typeof inline.content === 'string' ? inline.content : '';
    if (!headingText.trim()) {
      return original(tokens, idx, options, env, self);
    }
    const id = `note-${noteSlug}--${toSlug(headingText)}`;
    const token = tokens[idx];
    // Assumes no upstream plugin pre-assigns heading ids. If one ever does
    // (e.g. markdown-it-attrs with a `{ #my-id }` annotation), the existing
    // id wins and won't be scoped — which means the un-scoped id can collide
    // across notes in the unified report document. If/when we adopt such a
    // plugin, decide whether to always overwrite (lossy but consistent) or
    // to scope alongside (e.g. add a second id="note-...--<author-id>").
    if (!token.attrGet('id')) {
      token.attrSet('id', id);
    }
    return original(tokens, idx, options, env, self);
  };
}

/**
 * Matches `id="..."` or `id='...'` inside raw HTML and rewrites the value to
 * the scoped+slugged form. We intentionally only touch ids in raw HTML the
 * markdown source emitted — code spans/fences come through as text, not raw
 * HTML, so they are untouched.
 */
const ID_ATTR_RE = /\bid=("|')([^"']+)\1/g;

function installRawHtmlIdRewrite(
  md: markdownit,
  getCurrentNoteSlug: () => string | null
): void {
  const rewriteRuleFor = (kind: 'html_inline' | 'html_block') => {
    const original =
      md.renderer.rules[kind] ??
      function (tokens: any, idx: any, options: any, _env: any, self: any) {
        return self.renderToken(tokens, idx, options);
      };
    md.renderer.rules[kind] = function (
      tokens: any,
      idx: any,
      options: any,
      env: any,
      self: any
    ) {
      const noteSlug = getCurrentNoteSlug();
      if (!noteSlug) {
        return original(tokens, idx, options, env, self);
      }
      const token = tokens[idx];
      const content: string = token.content ?? '';
      if (!content || !ID_ATTR_RE.test(content)) {
        ID_ATTR_RE.lastIndex = 0;
        return original(tokens, idx, options, env, self);
      }
      ID_ATTR_RE.lastIndex = 0;
      token.content = content.replace(
        ID_ATTR_RE,
        (_match, quote, value) =>
          `id=${quote}note-${noteSlug}--${toSlug(value)}${quote}`
      );
      return original(tokens, idx, options, env, self);
    };
  };
  rewriteRuleFor('html_inline');
  rewriteRuleFor('html_block');
}
