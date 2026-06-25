/*global markdownit:readonly*/

import {
  FoamGraph,
  FoamWorkspace,
  MarkdownLink,
  Resource,
  ResourceLink,
  ResourceParser,
  URI,
  createRenderContext,
  toSlug,
} from '@foam/core';
import { createFoamMarkdownIt } from '../preview/foam-markdown-it';
import { createHtmlPageLinkResolver } from '../preview/link-resolvers';
import { collectInReportBacklinks } from './backlinks';
import { commonPathBase, slugForUri } from './slug';
import { installIdScoping } from './id-scoping';
import {
  AttachmentHrefResolver,
  installMarkdownLinkAnchors,
} from './markdown-link-anchors';
import { installTableWrapping } from './wrap-tables';

/**
 * Reads bytes for an attachment so the report can inline it as a data URI.
 * Returns null when the attachment can't be read; the inlining path then
 * skips this attachment (no entry in the inline-src map).
 */
export type AttachmentReader = (uri: URI) => Promise<Buffer | null>;

/**
 * How a markdown link to a workspace attachment (PDF, spreadsheet, doc,
 * etc.) is rendered in the report:
 *
 * - `'ignore'` (default): drop the anchor and render the link's label as
 *   plain text. Keeps the report portable — a clickable target that only
 *   resolves on the author's machine is worse than no target at all.
 * - `'file'`: rewrite to an absolute `file://` URL. Useful for personal
 *   reports that won't be shared; breaks if the HTML is moved.
 *
 * Images (`![alt](image.png)`) are inlined as data URIs regardless of
 * this option.
 */
export type AttachmentLinkMode = 'ignore' | 'file';

export interface RenderReportOptions {
  workspace: FoamWorkspace;
  graph: FoamGraph;
  parser: ResourceParser;
  /** URIs of the notes to include, in document order. */
  noteUris: URI[];
  /** Map from URI to the note's raw markdown text. */
  noteContent: Map<string, string>;
  /** Title shown at the top of the report. */
  title: string;
  /** ISO timestamp shown in the header. */
  generatedAt: Date;
  /** Resolves an attachment URI to bytes; returns null to leave the src alone. */
  readAttachment: AttachmentReader;
  /** How to render markdown links to attachments. Defaults to `'ignore'`
   * so the report stays portable as a standalone artifact. */
  attachmentLinks?: AttachmentLinkMode;
}

interface RenderedNote {
  uri: URI;
  resource: Resource;
  slug: string;
  bodyHtml: string;
  previewHtml: string;
}

/**
 * Renders the report as a single self-contained HTML string. Caller writes
 * it to disk and (optionally) opens it.
 */
export async function renderReport(options: RenderReportOptions): Promise<string> {
  const {
    workspace,
    graph,
    parser,
    noteUris,
    noteContent,
    title,
    generatedAt,
    readAttachment,
    attachmentLinks = 'ignore',
  } = options;

  // Slugs are computed relative to the deepest directory shared by every
  // included note. That keeps anchors short (no `/Users/...` baked in) and
  // self-contained — no need to know the workspace root.
  const slugBase = commonPathBase(noteUris);
  const includedSlugs = new Map<string, string>();
  for (const uri of noteUris) {
    includedSlugs.set(uri.toString(), slugForUri(uri, slugBase));
  }

  // `slugFor` is total (used for own-section anchors where the URI is
  // known to be in the report). `reportSlug` returns null for URIs outside
  // the report, used by callers that need to drop the anchor for excluded
  // notes (link-anchors plugin, foam-query's `toHref`).
  const slugFor = (uri: URI) =>
    includedSlugs.get(uri.toString()) ?? slugForUri(uri, slugBase);
  const reportSlug = (uri: URI) =>
    includedSlugs.get(uri.toString()) ?? null;

  const linkResolver = createHtmlPageLinkResolver(noteUris, slugFor);

  // Collect attachments referenced by any included note and inline them as
  // data URIs. We do this before rendering so the markdown-it `normalizeLink`
  // hook can serve the cached data URIs synchronously.
  const inlinedSrc = new Map<string, string>();
  await inlineAttachments({
    workspace,
    noteUris,
    noteContent,
    readAttachment,
    inlinedSrc,
  });

  // Per-note current-resource pointer — set before each render so foam-query's
  // `$current` and self-fragment embeds resolve against the right note. The
  // section-anchor plugin reads the slug off the same pointer.
  let currentResource: Resource | null = null;
  const getCurrentResource = () => currentResource;
  const getCurrentNoteSlug = () => (currentResource ? slugFor(currentResource.uri) : null);

  const getCurrentNoteUri = () => currentResource?.uri ?? null;

  const renderContext = createRenderContext();
  const attachmentHref = buildAttachmentHrefResolver(attachmentLinks);
  const md = createFoamMarkdownIt({
    workspace,
    graph,
    parser,
    linkResolver,
    getCurrentResource,
    isTrusted: () => false,
    // Map foam-query result URIs to in-doc anchors, or `null` for notes
    // outside the report set (rendered as plain text by `noteLink`).
    toHref: (uri: URI) => {
      const slug = reportSlug(uri);
      if (!slug) return null;
      const sectionPart = uri.fragment ? `--${toSlug(uri.fragment)}` : '';
      return `#note-${slug}${sectionPart}`;
    },
    isVirtualWorkspace: () => false,
    getEmbedNoteType: () => 'full-card',
    renderContext,
    innerMdOptions: { html: true },
    // Wrap so the report owns the chrome — see `.report-query-result` styles.
    // `empty` shape stays unwrapped so the placeholder reads as a paragraph.
    onDidRender: event =>
      event.shape === 'empty'
        ? event.html
        : `<div class="report-query-result" data-shape="${event.shape}">${event.html}</div>`,
    extensions: [
      inner => installImageInliner(inner, inlinedSrc),
      inner => installIdScoping(inner, getCurrentNoteSlug),
      installTableWrapping,
      inner =>
        installMarkdownLinkAnchors(inner, {
          workspace,
          getCurrentNoteUri,
          reportSlug,
          attachmentHref,
        }),
    ],
  });

  const rendered: RenderedNote[] = [];
  for (const uri of noteUris) {
    const resource = workspace.find(uri);
    if (!resource) continue;
    currentResource = resource;
    const raw = noteContent.get(uri.toString()) ?? '';
    const bodyHtml = md.render(stripTitleHeading(raw, resource));
    const previewHtml = bodyHtml;
    rendered.push({
      uri,
      resource,
      slug: slugFor(uri),
      bodyHtml,
      previewHtml,
    });
  }

  const tocHtml = renderToc(rendered);
  const sectionsHtml = rendered
    .map(note => renderSection(note, rendered, workspace, graph, noteUris))
    .join('\n');
  const previewsHtml = renderPreviewTemplates(rendered);

  return wrapDocument({
    title,
    generatedAt,
    noteCount: rendered.length,
    tocHtml,
    sectionsHtml,
    previewsHtml,
  });
}

/**
 * Removes a leading H1 that matches the resource title — the report renders
 * the title as the section header, so keeping it in the body would duplicate
 * it. Heuristic: only the very first non-blank line, only if it's `# Title`.
 */
function stripTitleHeading(raw: string, resource: Resource): string {
  const lines = raw.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  if (i >= lines.length) return raw;
  const match = lines[i].match(/^#\s+(.+?)\s*$/);
  if (match && match[1].trim() === resource.title.trim()) {
    lines.splice(i, 1);
    // Drop the immediately following blank line if any so spacing stays tight.
    if (lines[i]?.trim() === '') {
      lines.splice(i, 1);
    }
    return lines.join('\n');
  }
  return raw;
}

interface InlineAttachmentsArgs {
  workspace: FoamWorkspace;
  noteUris: URI[];
  noteContent: Map<string, string>;
  readAttachment: AttachmentReader;
  inlinedSrc: Map<string, string>;
}

async function inlineAttachments(args: InlineAttachmentsArgs): Promise<void> {
  const { workspace, noteUris, readAttachment, inlinedSrc } = args;

  // Phase 1: collect every attachment ref across every included note, grouped
  // by attachment URI. We need every raw-target string each URI was referenced
  // with so the inline-src lookup hits at render time.
  const rawTargetsByUri = new Map<string, { uri: URI; rawTargets: Set<string> }>();
  for (const noteUri of noteUris) {
    const resource = workspace.find(noteUri);
    if (!resource) continue;
    for (const ref of collectAttachmentRefs(workspace, resource)) {
      const key = ref.uri.toString();
      let entry = rawTargetsByUri.get(key);
      if (!entry) {
        entry = { uri: ref.uri, rawTargets: new Set() };
        rawTargetsByUri.set(key, entry);
      }
      entry.rawTargets.add(ref.rawTarget);
    }
  }

  // Phase 2: read every unique attachment in parallel. Failures (null bytes
  // or thrown exceptions) are localised to the attachment — the rest still
  // inline. The promise array is unordered; results land in `inlinedSrc`
  // independently.
  await Promise.all(
    Array.from(rawTargetsByUri.values()).map(async ({ uri, rawTargets }) => {
      let bytes: Buffer | null;
      try {
        bytes = await readAttachment(uri);
      } catch {
        return; // best-effort
      }
      if (!bytes) return;
      const mime = mimeForExtension(uri.path);
      const base64 = bytes.toString('base64');
      const dataUri = `data:${mime};base64,${base64}`;
      // Store under the resolved absolute path so the wikilink-embed plugin's
      // `withLinksRelativeToWorkspaceRoot` rewrite still hits.
      inlinedSrc.set(uri.path, dataUri);
      // And store under every raw target that referenced this URI — that's
      // what markdown-it will hand to `normalizeLink` at render time (e.g.
      // `logo.png` rather than the resolved absolute path).
      for (const rawTarget of rawTargets) {
        inlinedSrc.set(rawTarget, dataUri);
      }
    })
  );
}

interface AttachmentRef {
  /** The string markdown-it will hand to `normalizeLink` at render time. */
  rawTarget: string;
  /** The resolved absolute URI of the attachment in the workspace. */
  uri: URI;
}

/**
 * Walks a resource's parsed `links` and yields every reference that points at
 * an image or attachment in the workspace. Uses `workspace.resolveLink` so
 * reference-style images (`![alt][ref]`), wikilink embeds (`![[image.png]]`),
 * and standard markdown images (`![alt](logo.png)`) are all handled uniformly.
 */
function collectAttachmentRefs(
  workspace: FoamWorkspace,
  resource: Resource
): AttachmentRef[] {
  const out: AttachmentRef[] = [];
  for (const link of resource.links) {
    if (link.type === 'external') continue;
    let targetUri: URI;
    try {
      targetUri = workspace.resolveLink(resource, link);
    } catch {
      continue;
    }
    if (targetUri.isPlaceholder()) continue;
    const target = workspace.find(targetUri);
    if (!target || target.type === 'note') continue;
    const rawTarget = rawTargetFor(link);
    if (rawTarget !== null) {
      out.push({ rawTarget, uri: target.uri });
    }
  }
  return out;
}

/**
 * Returns the literal `src` string markdown-it will see for this link at
 * render time — wikilink target, markdown link target, or resolved reference
 * URL — so we can use it as a key in the inline-data-URI map. Returns `null`
 * when `analyzeLink` can't produce a non-empty target (malformed link, or a
 * link with only a fragment), in which case there's nothing to add to the
 * inline map for this reference.
 */
function rawTargetFor(link: ResourceLink): string | null {
  try {
    const { target } = MarkdownLink.analyzeLink(link);
    return target === '' ? null : target;
  } catch {
    return null;
  }
}

function mimeForExtension(path: string): string {
  const ext = path.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '';
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'svg':
      return 'image/svg+xml';
    case 'webp':
      return 'image/webp';
    case 'avif':
      return 'image/avif';
    case 'bmp':
      return 'image/bmp';
    case 'ico':
      return 'image/x-icon';
    case 'pdf':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
}

function installImageInliner(md: markdownit, inlinedSrc: Map<string, string>): void {
  const original = md.normalizeLink;
  md.normalizeLink = (url: string) => {
    const normalized = original.call(md, url);
    const hit = inlinedSrc.get(url) ?? inlinedSrc.get(normalized);
    return hit ?? normalized;
  };
}

/**
 * Translates the `AttachmentLinkMode` enum (see its docstring for semantics)
 * into the per-link callback the markdown-link-anchors plugin expects. Path
 * segments are percent-encoded so spaces survive the `file://` URL.
 */
function buildAttachmentHrefResolver(
  mode: AttachmentLinkMode
): AttachmentHrefResolver {
  if (mode === 'ignore') return () => null;
  return (uri: URI) => {
    const encodedPath = uri.path
      .split('/')
      .map(segment => encodeURIComponent(segment))
      .join('/');
    return `file://${encodedPath}`;
  };
}

function renderToc(notes: RenderedNote[]): string {
  const items = notes
    .map(
      note =>
        `    <li><a href="#note-${escapeAttr(note.slug)}">${escapeText(
          note.resource.title
        )}</a></li>`
    )
    .join('\n');
  return `<nav class="report-toc" aria-label="Table of contents">\n  <h2>Contents</h2>\n  <ol>\n${items}\n  </ol>\n</nav>`;
}

function renderSection(
  note: RenderedNote,
  allNotes: RenderedNote[],
  workspace: FoamWorkspace,
  graph: FoamGraph,
  includedUris: URI[]
): string {
  const backlinks = collectInReportBacklinks(workspace, graph, note.uri, includedUris);
  const backlinksHtml =
    backlinks.length === 0
      ? ''
      : `  <section class="backlinks" aria-label="Backlinks">
    <h3>Backlinks</h3>
    <ul>
${backlinks
  .map(
    bl =>
      `      <li><a href="#note-${escapeAttr(
        allNotes.find(n => n.uri.toString() === bl.sourceUri.toString())?.slug ?? ''
      )}">${escapeText(bl.sourceTitle)}</a></li>`
  )
  .join('\n')}
    </ul>
  </section>`;

  return `<section id="note-${escapeAttr(
    note.slug
  )}" class="report-note" data-note-slug="${escapeAttr(note.slug)}">
  <h2 class="report-note__title">${escapeText(note.resource.title)}</h2>
  <div class="report-note__body">
${note.bodyHtml}
  </div>
${backlinksHtml}
</section>`;
}

function renderPreviewTemplates(notes: RenderedNote[]): string {
  return notes
    .map(
      note =>
        `<template class="report-preview" data-preview-for="${escapeAttr(
          note.slug
        )}"><div class="report-preview__title">${escapeText(
          note.resource.title
        )}</div><div class="report-preview__body">${note.previewHtml}</div></template>`
    )
    .join('\n');
}

interface WrapDocumentArgs {
  title: string;
  generatedAt: Date;
  noteCount: number;
  tocHtml: string;
  sectionsHtml: string;
  previewsHtml: string;
}

/**
 * Foam icon as a URL-encoded SVG data URI, used as the report's favicon so
 * the HTML file stays self-contained (no external asset to ship alongside it).
 * Mirrors `assets/icon/foam-icon.svg`; keep them in sync if the brand changes.
 */
const FAVICON_DATA_URI =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">' +
      '<circle cx="128" cy="128" r="128" fill="#fff"/>' +
      '<circle cx="128" cy="128" r="124" fill="#c0c0ff"/>' +
      '<circle cx="110" cy="110" r="70" fill="#00f"/>' +
      '</svg>'
  );

function wrapDocument(args: WrapDocumentArgs): string {
  const { title, generatedAt, noteCount, tocHtml, sectionsHtml, previewsHtml } = args;
  const timestamp = generatedAt.toISOString();
  const humanDate = generatedAt.toISOString().slice(0, 10);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeText(title)}</title>
<meta name="generator" content="Foam">
<meta name="generated-at" content="${escapeAttr(timestamp)}">
<meta name="color-scheme" content="light dark">
<link rel="icon" type="image/svg+xml" href="${FAVICON_DATA_URI}">
<style>${REPORT_STYLES}</style>
</head>
<body>
<nav id="report-breadcrumb" class="report-breadcrumb" aria-label="Current location">
  <div class="report-breadcrumb__inner">
    <ol class="report-breadcrumb__crumbs">
      <li class="report-breadcrumb__title"><a href="#top">${escapeText(title)}</a></li>
      <li class="report-breadcrumb__note" data-breadcrumb-slot="note" hidden></li>
      <li class="report-breadcrumb__section" data-breadcrumb-slot="section" hidden></li>
    </ol>
    <button id="report-theme-toggle" class="report-theme-toggle" type="button" aria-label="Toggle dark mode" title="Toggle dark mode">
      <svg class="report-theme-toggle__sun" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <circle cx="12" cy="12" r="4" fill="currentColor"/>
        <g stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="12" y1="2" x2="12" y2="5"/>
          <line x1="12" y1="19" x2="12" y2="22"/>
          <line x1="2" y1="12" x2="5" y2="12"/>
          <line x1="19" y1="12" x2="22" y2="12"/>
          <line x1="4.9" y1="4.9" x2="7" y2="7"/>
          <line x1="17" y1="17" x2="19.1" y2="19.1"/>
          <line x1="4.9" y1="19.1" x2="7" y2="17"/>
          <line x1="17" y1="7" x2="19.1" y2="4.9"/>
        </g>
      </svg>
      <svg class="report-theme-toggle__moon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="currentColor"/>
      </svg>
    </button>
  </div>
</nav>
<a id="top"></a>
<article class="report">
<header class="report-header">
<h1>${escapeText(title)}</h1>
<p class="report-meta">Generated ${escapeText(humanDate)} from ${noteCount} note${
    noteCount === 1 ? '' : 's'
  }</p>
</header>
${tocHtml}
<main class="report-body">
${sectionsHtml}
</main>
</article>
<div class="report-previews" hidden>
${previewsHtml}
</div>
<div id="report-hover-preview" class="report-hover-preview" hidden></div>
<a class="report-attribution" href="https://foam.md" target="_blank" rel="noopener noreferrer" aria-label="Published with Foam">
  <svg class="report-attribution__icon" viewBox="0 0 256 256" width="14" height="14" aria-hidden="true">
    <circle cx="128" cy="128" r="124" fill="#c0c0ff"/>
    <circle cx="110" cy="110" r="70" fill="#00f"/>
  </svg>
  Published with <strong>Foam</strong>
</a>
<script>${REPORT_SCRIPT}</script>
</body>
</html>`;
}

const REPORT_STYLES = `
/* ----- Tokens ----- */
:root {
  --report-font-body: "Charter", "Iowan Old Style", "Source Serif Pro", "Source Serif 4", Georgia, "Times New Roman", serif;
  --report-font-heading: "Inter", "Helvetica Neue", "Segoe UI", -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  --report-font-mono: "JetBrains Mono", "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;

  /* Light palette (default). Dark overrides live under html[data-theme="dark"]. */
  --report-bg: #fbfaf7;
  --report-surface: #ffffff;
  --report-surface-2: #f5f3ee;
  --report-text: #1c1c1c;
  --report-muted: #6b6b6b;
  --report-faint: #9a9a9a;
  --report-rule: #e3dfd6;
  --report-rule-strong: #c8c3b6;
  --report-accent: #0b5fff;
  --report-accent-soft: rgba(11, 95, 255, 0.08);
  --report-code-bg: #f1efe8;
  --report-shadow: 0 12px 32px rgba(0, 0, 0, 0.08);
  --report-selection: rgba(11, 95, 255, 0.2);
}

html[data-theme="dark"] {
  --report-bg: #15171a;
  --report-surface: #1c1f23;
  --report-surface-2: #22262b;
  --report-text: #e4e6e8;
  --report-muted: #9aa0a6;
  --report-faint: #6b7178;
  --report-rule: #2c3137;
  --report-rule-strong: #3a4047;
  --report-accent: #6ea8ff;
  --report-accent-soft: rgba(110, 168, 255, 0.16);
  --report-code-bg: #22262b;
  --report-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  --report-selection: rgba(110, 168, 255, 0.32);
}

/* Respect the OS preference when the user hasn't picked anything explicitly. */
@media (prefers-color-scheme: dark) {
  html:not([data-theme]) {
    --report-bg: #15171a;
    --report-surface: #1c1f23;
    --report-surface-2: #22262b;
    --report-text: #e4e6e8;
    --report-muted: #9aa0a6;
    --report-faint: #6b7178;
    --report-rule: #2c3137;
    --report-rule-strong: #3a4047;
    --report-accent: #6ea8ff;
    --report-accent-soft: rgba(110, 168, 255, 0.16);
    --report-code-bg: #22262b;
    --report-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
    --report-selection: rgba(110, 168, 255, 0.32);
  }
}

/* ----- Reset & base ----- */
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: var(--report-bg); color: var(--report-text); }
body {
  font-family: var(--report-font-body);
  font-size: 18px;
  line-height: 1.7;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  font-feature-settings: "kern", "liga", "onum";
  hanging-punctuation: first last;
  text-wrap: pretty;
}
::selection { background: var(--report-selection); }
:focus-visible { outline: 2px solid var(--report-accent); outline-offset: 3px; border-radius: 2px; }

/* ----- Sticky breadcrumb header -----
 * The outer <nav> spans the full window width so the blurred backdrop and
 * the bottom rule run edge-to-edge; the inner container mirrors .report's
 * max-width and padding so the crumbs line up with the article text.
 */
.report-breadcrumb {
  position: sticky;
  top: 0;
  z-index: 1100;
  background: color-mix(in srgb, var(--report-bg) 88%, transparent);
  -webkit-backdrop-filter: saturate(180%) blur(10px);
  backdrop-filter: saturate(180%) blur(10px);
  border-bottom: 1px solid transparent;
  transition: border-color 0.2s ease, background 0.2s ease;
  font-family: var(--report-font-heading);
  font-size: 0.85rem;
  color: var(--report-muted);
}
.report-breadcrumb__inner {
  max-width: 48rem;
  margin: 0 auto;
  padding: 0.5rem 1.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.report-breadcrumb[data-scrolled="true"] {
  border-bottom-color: var(--report-rule);
}
.report-breadcrumb__crumbs {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
  /* Truncate long crumbs gracefully on narrow viewports. */
  overflow: hidden;
}
.report-breadcrumb__crumbs li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  white-space: nowrap;
}
.report-breadcrumb__crumbs li + li::before {
  content: "›";
  color: var(--report-faint);
  font-size: 0.95rem;
  flex-shrink: 0;
}
.report-breadcrumb__crumbs li[hidden] { display: none; }
.report-breadcrumb__crumbs a,
.report-breadcrumb__crumbs span {
  color: var(--report-muted);
  text-decoration: none;
  letter-spacing: 0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
}
.report-breadcrumb__crumbs a:hover { color: var(--report-accent); }
.report-breadcrumb__title a { font-weight: 600; color: var(--report-text); }
/* Current note / section appear in stronger color since they reflect the
 * active section the reader is in. */
.report-breadcrumb__note a,
.report-breadcrumb__section a { color: var(--report-text); }

/* Anchor target used by the breadcrumb "back to top" link. */
#top { display: block; height: 0; }

/* ----- Theme toggle ----- */
.report-theme-toggle {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  border: 1px solid var(--report-rule);
  background: var(--report-surface);
  color: var(--report-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}
.report-theme-toggle:hover { color: var(--report-accent); border-color: var(--report-rule-strong); }
.report-theme-toggle__sun, .report-theme-toggle__moon { display: block; }
.report-theme-toggle__moon { display: none; }
html[data-theme="dark"] .report-theme-toggle__sun { display: none; }
html[data-theme="dark"] .report-theme-toggle__moon { display: block; }
@media (prefers-color-scheme: dark) {
  html:not([data-theme]) .report-theme-toggle__sun { display: none; }
  html:not([data-theme]) .report-theme-toggle__moon { display: block; }
}

/* ----- Layout ----- */
.report {
  max-width: 48rem;
  margin: 0 auto;
  padding: 4rem 1.75rem 6rem;
}

/* ----- Header ----- */
.report-header { margin-bottom: 3rem; }
.report-header h1 {
  font-family: var(--report-font-heading);
  font-size: clamp(2rem, 4vw, 2.75rem);
  line-height: 1.1;
  letter-spacing: -0.025em;
  margin: 0 0 0.4rem;
  font-weight: 700;
  text-wrap: balance;
}
.report-meta {
  font-family: var(--report-font-heading);
  color: var(--report-muted);
  font-size: 0.875rem;
  letter-spacing: 0.02em;
  margin: 0;
}

/* ----- Table of contents ----- */
.report-toc {
  margin: 0 0 4rem;
  padding: 1.5rem 1.75rem;
  border: 1px solid var(--report-rule);
  border-radius: 8px;
  background: var(--report-surface);
  font-family: var(--report-font-heading);
}
.report-toc h2 {
  margin: 0 0 0.85rem;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--report-muted);
  font-weight: 600;
}
.report-toc ol { margin: 0; padding-left: 1.5rem; font-size: 0.98rem; counter-reset: toc; list-style: none; padding-left: 0; }
.report-toc li {
  margin: 0.3rem 0;
  counter-increment: toc;
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
}
.report-toc li::before {
  content: counter(toc, decimal-leading-zero);
  font-variant-numeric: tabular-nums;
  font-size: 0.78rem;
  color: var(--report-faint);
  min-width: 1.75rem;
}
.report-toc a { color: var(--report-text); text-decoration: none; flex: 1; }
.report-toc a:hover { color: var(--report-accent); }

/* ----- Note sections ----- */
.report-note { margin-bottom: 5rem; scroll-margin-top: 4rem; }
.report-note__title {
  font-family: var(--report-font-heading);
  font-size: 1.75rem;
  letter-spacing: -0.015em;
  line-height: 1.2;
  margin: 0 0 1.5rem;
  padding-bottom: 0.6rem;
  border-bottom: 1px solid var(--report-rule);
  font-weight: 700;
  text-wrap: balance;
}

/* ----- Note body typography ----- */
.report-note__body {
  /* widow / orphan control for paragraphs */
  widows: 2;
  orphans: 2;
}
.report-note__body h1,
.report-note__body h2,
.report-note__body h3,
.report-note__body h4,
.report-note__body h5,
.report-note__body h6 {
  font-family: var(--report-font-heading);
  letter-spacing: -0.012em;
  margin-top: 2.25rem;
  margin-bottom: 0.75rem;
  line-height: 1.3;
  font-weight: 600;
  scroll-margin-top: 4rem;
  text-wrap: balance;
}
.report-note__body h1 { font-size: 1.5rem; }
.report-note__body h2 { font-size: 1.3rem; }
.report-note__body h3 { font-size: 1.1rem; }
.report-note__body h4,
.report-note__body h5,
.report-note__body h6 { font-size: 1rem; }
.report-note__body p { margin: 0 0 1.15rem; max-width: 38em; }
.report-note__body img {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  display: block;
  margin: 1.5rem 0;
}
.report-note__body figure { margin: 1.75rem 0; }
.report-note__body figcaption {
  font-family: var(--report-font-heading);
  font-size: 0.85rem;
  color: var(--report-muted);
  text-align: center;
  margin-top: 0.5rem;
}
.report-note__body hr {
  border: 0;
  border-top: 1px solid var(--report-rule);
  margin: 2.5rem 0;
}
.report-note__body ul,
.report-note__body ol { padding-left: 1.5rem; margin: 0 0 1.15rem; }
.report-note__body li { margin: 0.3rem 0; }
.report-note__body li p { margin-bottom: 0.5rem; }
.report-note__body li > ul,
.report-note__body li > ol { margin-top: 0.3rem; }

/* Code */
.report-note__body code {
  font-family: var(--report-font-mono);
  font-size: 0.88em;
  background: var(--report-code-bg);
  padding: 0.1em 0.4em;
  border-radius: 4px;
  font-feature-settings: normal;
}
.report-note__body pre {
  background: var(--report-code-bg);
  padding: 1rem 1.15rem;
  overflow-x: auto;
  border-radius: 8px;
  font-size: 0.88rem;
  line-height: 1.55;
  font-family: var(--report-font-mono);
  margin: 1.25rem 0;
  border: 1px solid var(--report-rule);
  font-feature-settings: normal;
}
.report-note__body pre code {
  background: transparent;
  padding: 0;
  font-size: inherit;
  border-radius: 0;
}

/* Blockquotes */
.report-note__body blockquote {
  border-left: 3px solid var(--report-rule-strong);
  margin: 1.5rem 0;
  padding: 0.4rem 1.25rem;
  color: var(--report-muted);
  font-style: italic;
}
.report-note__body blockquote p:last-child { margin-bottom: 0; }

/* Links */
.report-note__body a {
  color: var(--report-accent);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-decoration-color: color-mix(in srgb, var(--report-accent) 45%, transparent);
  text-underline-offset: 3px;
  transition: text-decoration-color 0.15s ease;
}
.report-note__body a:hover {
  text-decoration-color: var(--report-accent);
}
.report-note__body a.foam-note-link {
  color: var(--report-accent);
  text-decoration: none;
  background-image: linear-gradient(var(--report-accent), var(--report-accent));
  background-size: 100% 1px;
  background-position: 0 100%;
  background-repeat: no-repeat;
  padding-bottom: 1px;
}
.report-note__body a.foam-note-link:hover {
  background-color: var(--report-accent-soft);
}

/* ----- Tables -----
 * Two wrappers, same visual treatment: the rounded border + horizontal scroll
 * sit on the wrapper so the table inside can stretch to 100% of the available
 * column width.
 *   - .report-table-wrap   : standard markdown tables (installTableWrapping)
 *   - .report-query-result : foam-query output (onDidRender hook); also
 *                            wraps non-table shapes (list, count) so the
 *                            report stays in control of how query results
 *                            read alongside prose, not the foam-query-*
 *                            class strings.
 */
.report-table-wrap,
.report-note__body .report-query-result {
  margin: 1.75rem 0;
  border: 1px solid var(--report-rule);
  border-radius: 8px;
  overflow-x: auto;
  background: var(--report-surface);
}
.report-note__body table,
.report-note__body .report-query-result > table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--report-font-heading);
  font-size: 0.92rem;
  line-height: 1.5;
}
.report-note__body table thead,
.report-note__body .report-query-result > table thead {
  background: var(--report-surface-2);
}
.report-note__body table th,
.report-note__body .report-query-result > table th {
  font-weight: 600;
  text-align: left;
  padding: 0.65rem 1rem;
  color: var(--report-muted);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-size: 0.72rem;
  border-bottom: 1px solid var(--report-rule);
  white-space: nowrap;
}
.report-note__body table td,
.report-note__body .report-query-result > table td {
  padding: 0.7rem 1rem;
  border-bottom: 1px solid var(--report-rule);
  vertical-align: top;
}
.report-note__body table tbody tr:last-child td,
.report-note__body .report-query-result > table tbody tr:last-child td { border-bottom: 0; }
.report-note__body table tbody tr:nth-child(2n) td,
.report-note__body .report-query-result > table tbody tr:nth-child(2n) td {
  background: color-mix(in srgb, var(--report-surface-2) 50%, transparent);
}
.report-note__body table tbody tr:hover td,
.report-note__body .report-query-result > table tbody tr:hover td {
  background: var(--report-accent-soft);
}
.report-note__body table code,
.report-note__body .report-query-result > table code {
  font-size: 0.85em;
  padding: 0.05em 0.3em;
}

/* foam-query: non-table shapes inside the wrapper read as prose, not a card.
 * Drop the wrapper chrome for them so a list or count doesn't get jammed into
 * a bordered scroll box. */
.report-note__body .report-query-result:has(> ul),
.report-note__body .report-query-result:has(> span) {
  border: 0;
  border-radius: 0;
  background: none;
  overflow: visible;
  margin: 1rem 0;
}
.report-note__body .report-query-result > ul {
  font-family: var(--report-font-body);
  font-size: 1rem;
  margin: 0;
  padding-left: 1.5rem;
}
.report-note__body .report-query-result > ul li { margin: 0.3rem 0; }
.report-note__body .report-query-result > span {
  display: inline-block;
  font-family: var(--report-font-heading);
  font-size: 0.92rem;
  font-weight: 600;
  padding: 0.2rem 0.6rem;
  background: var(--report-surface-2);
  border-radius: 4px;
  color: var(--report-text);
}

/* Empty results / errors / warnings are emitted by foam-query without the
 * report wrapper (we skip shape === empty), so target them at the source. */
.report-note__body .foam-query-empty {
  color: var(--report-muted);
  font-style: italic;
  font-family: var(--report-font-heading);
  font-size: 0.95rem;
  background: var(--report-surface-2);
  padding: 0.75rem 1rem;
  border-radius: 6px;
  border-left: 3px solid var(--report-rule-strong);
}

/* Foam embeds */
.report-note__body .embed-container-note {
  background: var(--report-surface);
  border: 1px solid var(--report-rule);
  border-radius: 8px;
  padding: 1.25rem 1.5rem;
  margin: 1.5rem 0;
}
.report-note__body .embed-container-note > :first-child { margin-top: 0; }
.report-note__body .embed-container-note > :last-child { margin-bottom: 0; }
.report-note__body .foam-cyclic-link-warning,
.report-note__body .foam-embed-not-supported-warning {
  background: var(--report-surface-2);
  border-left: 3px solid var(--report-rule-strong);
  padding: 0.75rem 1rem;
  margin: 1rem 0;
  font-family: var(--report-font-heading);
  font-size: 0.9rem;
  color: var(--report-muted);
  border-radius: 4px;
}

/* ----- Backlinks ----- */
.backlinks {
  margin-top: 2.5rem;
  padding: 1.1rem 1.4rem;
  background: var(--report-surface);
  border: 1px solid var(--report-rule);
  border-radius: 8px;
  font-size: 0.95rem;
  font-family: var(--report-font-heading);
}
.backlinks h3 {
  margin: 0 0 0.6rem;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--report-muted);
  font-weight: 600;
}
.backlinks ul { margin: 0; padding-left: 1.25rem; }
.backlinks a { color: var(--report-text); text-decoration: none; }
.backlinks a:hover { color: var(--report-accent); text-decoration: underline; }

/* ----- Hover preview ----- */
.report-hover-preview {
  position: absolute;
  max-width: 26rem;
  background: var(--report-surface);
  border: 1px solid var(--report-rule);
  border-radius: 8px;
  box-shadow: var(--report-shadow);
  padding: 1.1rem 1.35rem;
  z-index: 1000;
  font-size: 0.92rem;
  line-height: 1.55;
  color: var(--report-text);
}
.report-hover-preview[hidden] { display: none; }
.report-preview__title {
  font-family: var(--report-font-heading);
  font-weight: 600;
  margin-bottom: 0.5rem;
  font-size: 0.95rem;
}
.report-preview__body {
  max-height: 18rem;
  overflow: hidden;
  -webkit-mask-image: linear-gradient(to bottom, black 70%, transparent 100%);
  mask-image: linear-gradient(to bottom, black 70%, transparent 100%);
}
.report-preview__body p:first-child { margin-top: 0; }
.report-preview__body img { max-width: 100%; height: auto; }

/* ----- Attribution badge ----- */
.report-attribution {
  position: fixed;
  bottom: 0.75rem;
  right: 0.75rem;
  z-index: 1050;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.7rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--report-surface) 92%, transparent);
  border: 1px solid var(--report-rule);
  font-family: var(--report-font-heading);
  font-size: 0.75rem;
  letter-spacing: 0.01em;
  color: var(--report-muted);
  text-decoration: none;
  -webkit-backdrop-filter: saturate(180%) blur(8px);
  backdrop-filter: saturate(180%) blur(8px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}
.report-attribution:hover {
  color: var(--report-text);
  border-color: var(--report-rule-strong);
}
.report-attribution strong {
  color: var(--report-text);
  font-weight: 600;
}
.report-attribution__icon { flex-shrink: 0; }

/* ----- Responsive ----- */
@media (max-width: 640px) {
  body { font-size: 17px; line-height: 1.65; }
  .report { padding: 3rem 1.25rem 4rem; }
  .report-toc { padding: 1.25rem; }
  .report-breadcrumb { font-size: 0.8rem; }
  .report-breadcrumb__inner { padding: 0.4rem 1.25rem; }
}

/* ----- Print ----- */
@page { margin: 1.5cm 1.8cm; }
@media print {
  /* Force light tokens for print so the report always looks like a paper
   * document, even when the user has explicitly toggled dark mode. The
   * data-theme selectors are matched explicitly so we beat the higher
   * specificity of the dark-mode override above; prefers-color-scheme
   * doesn't apply during print so the :root rule covers the default branch. */
  :root,
  html[data-theme="light"],
  html[data-theme="dark"] {
    --report-bg: #ffffff;
    --report-surface: #ffffff;
    --report-surface-2: #f5f3ee;
    --report-text: #000000;
    --report-muted: #444444;
    --report-faint: #777777;
    --report-rule: #cccccc;
    --report-rule-strong: #999999;
    --report-accent: #0033aa;
    --report-accent-soft: rgba(0, 51, 170, 0.08);
    --report-code-bg: #f1efe8;
    --report-shadow: none;
    --report-selection: rgba(0, 51, 170, 0.2);
  }
  html, body { background: white; }
  body { font-size: 10.5pt; line-height: 1.4; }
  .report { max-width: none; padding: 0; }
  .report-toc { break-after: page; }
  .report-note { break-before: page; margin-bottom: 0; }
  .report-note:first-of-type { break-before: auto; }
  .report-note__body pre,
  .report-note__body blockquote,
  .report-note__body figure,
  .report-note__body table,
  .backlinks { break-inside: avoid; }
  .report-note__body h1,
  .report-note__body h2,
  .report-note__body h3,
  .report-note__body h4,
  .report-note__body h5,
  .report-note__body h6 { margin-top: 1.25rem; }
  .report-note__body h1,
  .report-note__body h2,
  .report-note__body h3 { break-after: avoid; }
  .report-note__body p,
  .report-note__body li { widows: 3; orphans: 3; }
  .report-breadcrumb,
  .report-theme-toggle,
  .report-hover-preview,
  .report-previews { display: none !important; }
  a { color: inherit; text-decoration: underline; }
  .report-note__body a.foam-note-link { background-image: none; padding-bottom: 0; }
  /* Show external link URLs after the anchor in print. */
  .report-note__body a[href^="http"]::after {
    content: " (" attr(href) ")";
    font-size: 0.85em;
    color: var(--report-muted);
    word-break: break-all;
  }
  /* Attribution badge: switch from floating chrome to a flowing footer
   * element at the end of the document, right-aligned. The ::after URL
   * expansion above would print the full foambubble URL after the label,
   * which is noise on paper — suppress it for this anchor only. */
  .report-attribution {
    position: static;
    display: block;
    margin: 3rem 0 0;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: none;
    box-shadow: none;
    text-align: right;
    font-size: 9pt;
    color: var(--report-muted);
  }
  .report-attribution::after { content: none !important; }
  .report-attribution__icon { display: inline-block; vertical-align: -2px; margin-right: 0.25em; }
}
`;

const REPORT_SCRIPT = `
(function(){
  // ----- Theme toggle (persisted across reloads) -----
  var html = document.documentElement;
  var STORAGE_KEY = 'foam-report-theme';
  try {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') html.setAttribute('data-theme', saved);
  } catch (_) { /* private mode or storage disabled — fall back to prefers-color-scheme */ }

  var toggle = document.getElementById('report-theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', function(){
      var current = html.getAttribute('data-theme');
      var next;
      if (current === 'dark') next = 'light';
      else if (current === 'light') next = 'dark';
      else {
        // No explicit choice yet: flip relative to the OS preference.
        var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        next = prefersDark ? 'light' : 'dark';
      }
      html.setAttribute('data-theme', next);
      try { localStorage.setItem(STORAGE_KEY, next); } catch (_) {}
    });
  }

  // ----- Breadcrumb header -----
  var breadcrumb = document.getElementById('report-breadcrumb');
  var noteSlot = breadcrumb && breadcrumb.querySelector('[data-breadcrumb-slot="note"]');
  var sectionSlot = breadcrumb && breadcrumb.querySelector('[data-breadcrumb-slot="section"]');

  function setCrumb(slot, title, href){
    if (!slot) return;
    if (!title) { slot.hidden = true; slot.innerHTML = ''; return; }
    slot.hidden = false;
    if (href) {
      var a = document.createElement('a');
      a.href = href;
      a.textContent = title;
      slot.replaceChildren(a);
    } else {
      var span = document.createElement('span');
      span.textContent = title;
      slot.replaceChildren(span);
    }
  }

  if (breadcrumb) {
    // Border-on-scroll affordance — visible only once content scrolls under it.
    var onScroll = function(){
      var scrolled = (window.scrollY || window.pageYOffset) > 4;
      breadcrumb.setAttribute('data-scrolled', scrolled ? 'true' : 'false');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // The active note is the lowest .report-note whose top has scrolled past
    // the breadcrumb. We sample on scroll (with rAF) rather than IntersectionObserver
    // because we want a single "current" not a set.
    var notes = Array.prototype.slice.call(document.querySelectorAll('.report-note'));
    var headingsByNote = new Map();
    notes.forEach(function(section){
      headingsByNote.set(section, Array.prototype.slice.call(
        section.querySelectorAll(':scope > .report-note__body :is(h1,h2,h3,h4)')
      ));
    });

    var lastNote = null, lastSection = null;
    var ticking = false;
    function update(){
      ticking = false;
      var scrollY = window.scrollY || window.pageYOffset;
      var threshold = scrollY + (breadcrumb.offsetHeight || 0) + 8;

      // Find the latest note section whose top is above the threshold.
      var activeNote = null;
      for (var i = 0; i < notes.length; i++){
        if (notes[i].offsetTop <= threshold) activeNote = notes[i];
        else break;
      }

      if (activeNote !== lastNote) {
        if (activeNote) {
          var titleEl = activeNote.querySelector('.report-note__title');
          var noteTitle = titleEl ? titleEl.textContent : '';
          setCrumb(noteSlot, noteTitle, '#' + activeNote.id);
        } else {
          setCrumb(noteSlot, null);
        }
        lastNote = activeNote;
      }

      // Find the latest heading inside the active note that's above the threshold.
      var activeSection = null;
      if (activeNote) {
        var headings = headingsByNote.get(activeNote) || [];
        for (var j = 0; j < headings.length; j++){
          if (headings[j].getBoundingClientRect().top + scrollY <= threshold) {
            activeSection = headings[j];
          } else break;
        }
      }
      if (activeSection !== lastSection) {
        if (activeSection && activeSection.id) {
          setCrumb(sectionSlot, activeSection.textContent || '', '#' + activeSection.id);
        } else {
          setCrumb(sectionSlot, null);
        }
        lastSection = activeSection;
      }
    }
    window.addEventListener('scroll', function(){
      if (!ticking) { window.requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  // ----- Hover previews -----
  var hover = document.getElementById('report-hover-preview');
  if (!hover) return;
  var templates = {};
  document.querySelectorAll('.report-previews template[data-preview-for]').forEach(function(t){
    templates[t.getAttribute('data-preview-for')] = t.innerHTML;
  });
  // Tags considered "content-bearing" when an empty anchor marker is nested
  // inside one of them. Used by the climb-to-parent rule below.
  var CONTENT_TAGS = /^(P|LI|BLOCKQUOTE|TD|TR|FIGURE|PRE|TABLE|DIV)$/;
  function slugFromHref(href){
    if (!href) return null;
    var m = href.match(/#note-(.+)$/);
    if (!m) return null;
    // The note slug is everything before the '--' section separator (if any).
    // toSlug() collapses runs of non-alphanumerics, so the note slug itself
    // can't contain '--', making the split unambiguous.
    var rest = m[1];
    var idx = rest.indexOf('--');
    return idx === -1 ? rest : rest.substring(0, idx);
  }
  function headingLevelOf(el){
    if (!el || !el.tagName) return 0;
    var m = el.tagName.match(/^H([1-6])$/);
    return m ? +m[1] : 0;
  }
  function resolveTargetForPreview(el, rootEl){
    if (headingLevelOf(el) > 0) return { kind: 'heading', el: el };
    if (CONTENT_TAGS.test(el.tagName)) return { kind: 'block', el: el };
    // Empty anchor marker (e.g. <li><a id></a>text</li>) — climb to the
    // nearest content-bearing ancestor so the preview shows the surrounding
    // element rather than a zero-width anchor stub.
    var parent = el.parentElement;
    while (parent && parent !== rootEl) {
      if (CONTENT_TAGS.test(parent.tagName)) return { kind: 'block', el: parent };
      parent = parent.parentElement;
    }
    return { kind: 'whole-note' };
  }
  function extractSection(startEl){
    var level = headingLevelOf(startEl);
    var parts = [startEl.outerHTML];
    var budget = 1200;
    budget -= (startEl.textContent || '').length;
    var node = startEl.nextElementSibling;
    while (node && budget > 0) {
      var nextLevel = headingLevelOf(node);
      if (nextLevel > 0 && nextLevel <= level) break;
      parts.push(node.outerHTML);
      budget -= (node.textContent || '').length;
      node = node.nextElementSibling;
    }
    return parts.join('');
  }
  function previewBodyFor(slug, href){
    var template = templates[slug];
    if (!template) return null;
    var anchorId = (href || '').replace(/^#/, '');
    var isSectionAnchor = anchorId.indexOf('--') !== -1;
    if (!isSectionAnchor) return template;
    var noteFragment = document.createElement('div');
    noteFragment.innerHTML = template;
    var target;
    try {
      target = noteFragment.querySelector('#' + (window.CSS && CSS.escape ? CSS.escape(anchorId) : anchorId));
    } catch (_) { target = null; }
    if (!target) return template;
    var resolved = resolveTargetForPreview(target, noteFragment);
    if (resolved.kind === 'heading') return extractSection(resolved.el);
    if (resolved.kind === 'block') return resolved.el.outerHTML;
    return template;
  }
  function showPreview(target){
    var href = target.getAttribute('href');
    var slug = slugFromHref(href);
    if (!slug) return;
    var body = previewBodyFor(slug, href);
    if (!body) return;
    hover.innerHTML = body;
    hover.hidden = false;
    var rect = target.getBoundingClientRect();
    var scrollY = window.scrollY || window.pageYOffset;
    var top = rect.bottom + scrollY + 6;
    var left = rect.left + (window.scrollX || window.pageXOffset);
    // keep within the viewport horizontally
    var maxLeft = (window.innerWidth || document.documentElement.clientWidth) - hover.offsetWidth - 16;
    if (left > maxLeft) left = Math.max(8, maxLeft);
    hover.style.top = top + 'px';
    hover.style.left = left + 'px';
  }
  function hidePreview(){ hover.hidden = true; }
  document.body.addEventListener('mouseover', function(e){
    var a = e.target.closest && e.target.closest('a.foam-note-link[href^="#note-"]');
    if (a) showPreview(a);
  });
  document.body.addEventListener('mouseout', function(e){
    var a = e.target.closest && e.target.closest('a.foam-note-link[href^="#note-"]');
    if (a && !hover.contains(e.relatedTarget)) hidePreview();
  });
  hover.addEventListener('mouseleave', hidePreview);
})();
`;

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
