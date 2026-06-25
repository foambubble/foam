/*global markdownit:readonly*/

import { toSlug, URI, FoamWorkspace, Resource } from '@foam/core';

/**
 * Returns the href to use for an attachment referenced from a markdown link.
 *
 * - `string` → rewrite the anchor's href to this value.
 * - `null` → drop the anchor entirely; the label renders as plain prose.
 *   This is the right answer for a portable report where keeping a
 *   broken-or-misleading clickable target is worse than no target at all.
 *
 * The plugin stays policy-agnostic: the renderer picks the strategy
 * (file://, embed-as-data-URI, ignore, etc.) and this hook expresses it.
 */
export type AttachmentHrefResolver = (uri: URI) => string | null;

/**
 * Per-render hooks for resolving standard markdown links.
 *
 * `getCurrentNoteUri` lets relative links like `[Beta](../other/beta.md)`
 * resolve against the right note when the same `md` instance renders many
 * notes back-to-back. `reportSlug` returns the in-report slug for a resolved
 * resource URI (`null` when the URI isn't part of the report set).
 * `attachmentHref` decides how non-note resources (PDFs, images linked via
 * `[x](report.pdf)`, etc.) should be referenced.
 */
export interface MarkdownLinkAnchorsOptions {
  workspace: FoamWorkspace;
  getCurrentNoteUri: () => URI | null;
  reportSlug: (uri: URI) => string | null;
  attachmentHref?: AttachmentHrefResolver;
}

/**
 * Installs `renderer.rules.link_open` / `link_close` overrides that walk every
 * standard markdown link `[label](href)` and decide how it should render:
 *
 *   - included note → `<a class="foam-note-link" href="#note-<slug>">`
 *     (optionally `--<section>` when the link carries a `#fragment`).
 *   - note in workspace but NOT in the report → drop the anchor and emit the
 *     label as plain prose. Matches how wikilinks to excluded notes are
 *     rendered, so `[[x]]` and `[label](x.md)` behave consistently when `x`
 *     is excluded.
 *   - attachment → href provided by `attachmentHref`, or anchor dropped
 *     (label rendered as prose) when `attachmentHref` returns `null`.
 *   - anything else (external URLs, mailtos, fragment-only links, unknown
 *     paths) → untouched.
 */
export function installMarkdownLinkAnchors(
  md: markdownit,
  options: MarkdownLinkAnchorsOptions
): void {
  const { workspace, getCurrentNoteUri, reportSlug, attachmentHref } = options;

  const defaultOpen = (
    tokens: any,
    idx: any,
    opts: any,
    _env: any,
    self: any
  ) => self.renderToken(tokens, idx, opts);
  const defaultClose = defaultOpen;
  const originalOpen = md.renderer.rules.link_open ?? defaultOpen;
  const originalClose = md.renderer.rules.link_close ?? defaultClose;

  // Suppression stack: one bool per currently-open link. `true` means the
  // matching `link_close` must also be suppressed so the inner text renders
  // as plain prose. Markdown links don't nest in CommonMark, so the stack is
  // really just a single-slot flag in practice — modelled as a stack so the
  // pairing logic stays obvious.
  const suppressionStack: boolean[] = [];

  md.renderer.rules.link_open = function (
    tokens: any,
    idx: any,
    opts: any,
    env: any,
    self: any
  ) {
    const token = tokens[idx];
    const href: string = token.attrGet('href') ?? '';

    if (!shouldConsider(href)) {
      suppressionStack.push(false);
      return originalOpen(tokens, idx, opts, env, self);
    }

    const fromUri = getCurrentNoteUri();
    if (!fromUri) {
      suppressionStack.push(false);
      return originalOpen(tokens, idx, opts, env, self);
    }

    const { resource, fragment } = resolveLinkTarget(workspace, fromUri, href);
    if (!resource) {
      suppressionStack.push(false);
      return originalOpen(tokens, idx, opts, env, self);
    }

    if (resource.type === 'note') {
      const slug = reportSlug(resource.uri);
      if (!slug) {
        // Note exists but isn't part of the report set — drop the anchor so
        // the label renders as plain prose. The matching `link_close` below
        // will suppress its own output too.
        suppressionStack.push(true);
        return '';
      }
      const sectionPart = fragment ? `--${toSlug(fragment)}` : '';
      const newHref = `#note-${slug}${sectionPart}`;
      token.attrSet('href', newHref);
      addClass(token, 'foam-note-link');
      setOrPushAttr(token, 'data-href', newHref);
      suppressionStack.push(false);
      return originalOpen(tokens, idx, opts, env, self);
    }

    // Attachment or image: string → rewrite href; null → drop anchor;
    // omitted → leave href alone. See `AttachmentHrefResolver`.
    if (attachmentHref) {
      const newHref = attachmentHref(resource.uri);
      if (newHref === null) {
        suppressionStack.push(true);
        return '';
      }
      token.attrSet('href', newHref);
      setOrPushAttr(token, 'data-href', newHref);
    }
    suppressionStack.push(false);
    return originalOpen(tokens, idx, opts, env, self);
  };

  md.renderer.rules.link_close = function (
    tokens: any,
    idx: any,
    opts: any,
    env: any,
    self: any
  ) {
    // Pop in the same order we pushed. Defensive default to `false` so an
    // unexpected pairing (e.g. plugin order changes) doesn't drop trailing
    // `</a>` tags silently.
    const suppress = suppressionStack.length > 0 ? suppressionStack.pop() : false;
    if (suppress) return '';
    return originalClose(tokens, idx, opts, env, self);
  };
}

function shouldConsider(href: string): boolean {
  if (!href) return false;
  if (href.startsWith('#')) return false;
  if (href.startsWith('//')) return false;
  // Any URI scheme (`https:`, `mailto:`, `javascript:`, `data:`…) is treated
  // as external and left alone.
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href)) return false;
  return true;
}

/**
 * Looks up a markdown link's href in the workspace, returning the resolved
 * `Resource` (or null) and the link's `#fragment`. Used by the link_open rule
 * to decide how to rewrite the anchor.
 */
function resolveLinkTarget(
  workspace: FoamWorkspace,
  fromUri: URI,
  href: string
): { resource: Resource | null; fragment: string } {
  const hashAt = href.indexOf('#');
  const target = hashAt === -1 ? href : href.slice(0, hashAt);
  const fragment = hashAt === -1 ? '' : href.slice(hashAt + 1);
  if (!target) return { resource: null, fragment };

  let decoded = target;
  try {
    decoded = decodeURIComponent(target);
  } catch {
    // malformed escapes — fall back to the raw target
  }

  // A markdown link's href is by spec a path (CommonMark), never a wikilink
  // identifier. We normalise it to `./<path>` for bare relative targets so
  // `workspace.find` routes through its relative-path branch instead of its
  // identifier branch — the latter ignores `fromUri` and silently picks
  // whichever file with that basename wins the workspace's trie sort. Mirrors
  // what `MarkdownResourceProvider.resolveLink` does for `link` type links.
  const found =
    workspace.find(asRelativePath(decoded), fromUri) ??
    workspace.find(asRelativePath(target), fromUri);
  return { resource: found, fragment };
}

function asRelativePath(path: string): string {
  if (path.startsWith('./') || path.startsWith('../') || path.startsWith('/')) {
    return path;
  }
  return './' + path;
}

function addClass(token: any, cls: string): void {
  const existing = token.attrGet('class');
  if (!existing) {
    token.attrSet('class', cls);
    return;
  }
  if (existing.split(/\s+/).includes(cls)) return;
  token.attrSet('class', `${existing} ${cls}`);
}

function setOrPushAttr(token: any, name: string, value: string): void {
  const idx = token.attrIndex(name);
  if (idx < 0) {
    token.attrPush([name, value]);
  } else {
    token.attrs[idx][1] = value;
  }
}
