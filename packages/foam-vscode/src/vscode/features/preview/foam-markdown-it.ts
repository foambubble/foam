/*global markdownit:readonly*/

import MarkdownIt from 'markdown-it';
import markdownItFootnote from 'markdown-it-footnote';
import {
  FoamQueryRenderEvent,
  FoamWorkspace,
  FoamGraph,
  Resource,
  ResourceParser,
  RenderContext,
  ToHref,
  URI,
  createRenderContext,
} from '@foam/core';
import { default as markdownItFoamTags } from './tag-highlight';
import { default as markdownItWikilinkNavigation } from './wikilink-navigation';
import { default as markdownItRemoveLinkReferences } from './remove-wikilink-references';
import { default as markdownItWikilinkEmbed } from './wikilink-embed';
import { default as escapeWikilinkPipes } from './escape-wikilink-pipes';
import { default as markdownItBlockAnchorIds } from './block-anchor-ids';
import { default as markdownItFoamQuery } from './foam-query-renderer';
import { LinkResolver } from './wikilink-navigation';

/**
 * Options for assembling the Foam markdown-it pipeline. All host-specific
 * concerns are injected as functions so the factory itself stays decoupled
 * from VS Code and works in any environment that has a workspace and graph.
 */
export interface FoamMarkdownItOptions {
  workspace: FoamWorkspace;
  graph: FoamGraph;
  parser: ResourceParser;
  linkResolver: LinkResolver;
  /** Resolves the active resource for `$current` and self-fragment embeds. */
  getCurrentResource: () => Resource | null;
  /** Trust gate for foam-query JS execution. Defaults to `() => false`. */
  isTrusted?: () => boolean;
  /**
   * Builds the `href` value for note links emitted by foam-query results.
   * Returning `null` renders the title as plain text — used by the report
   * to drop links to notes outside the report set. Defaults to a stub that
   * returns the bare URI path, suitable for tests and the CLI.
   */
  toHref?: ToHref;
  /** Whether the host is a virtual workspace (no local FS). Defaults to false. */
  isVirtualWorkspace?: () => boolean;
  /** Default embed note type, e.g. `full-card`. */
  getEmbedNoteType?: () => string;
  /** Initial markdown-it options for fresh inner instances. */
  innerMdOptions?: { html?: boolean };
  /** Shared render context — pass one in to span multiple invocations,
   * otherwise a fresh one is created. */
  renderContext?: RenderContext;
  /** Forwarded to `markdownItFoamQuery`. See its docstring. */
  onDidRender?: (event: FoamQueryRenderEvent) => string;
  /**
   * Host-supplied installers that run on every markdown-it instance produced
   * by this factory — including inner instances built by `createInnerMd` for
   * note embeds and foam-query source-derived cells. Use this for plugins
   * that must apply uniformly across the pipeline (e.g. the report's image
   * inliner, id-scoping, link rewriting), not for one-shot extensions that
   * should only run on the outer instance.
   */
  extensions?: ((md: markdownit) => void)[];
}

/**
 * Builds a markdown-it instance carrying the full Foam pipeline:
 * pipe-escape → footnotes → embed → tags → navigation → reference cleanup
 * → block anchors → foam-query.
 *
 * The caller can either pass in an existing `md` to extend or omit it to get
 * a fresh one. Inner renders (for embeds and queries) get fresh instances
 * built from the same options.
 */
export function createFoamMarkdownIt(
  options: FoamMarkdownItOptions,
  target?: markdownit
): markdownit {
  const {
    workspace,
    graph,
    parser,
    linkResolver,
    getCurrentResource,
    isTrusted = () => false,
    toHref = (uri: URI) => uri.path,
    isVirtualWorkspace,
    getEmbedNoteType,
    innerMdOptions = { html: true },
    renderContext = createRenderContext(),
    onDidRender,
    extensions,
  } = options;

  const md = target ?? MarkdownIt(innerMdOptions);

  // Inherit html setting from the passed-in instance when extending, so inner
  // renders match the host's lockdown.
  const outerHtmlOption =
    (md as { options?: { html?: boolean } }).options?.html ??
    innerMdOptions.html ??
    true;

  const buildInner = (): markdownit =>
    createFoamMarkdownIt(
      { ...options, renderContext },
      MarkdownIt({ html: outerHtmlOption })
    );

  let r = escapeWikilinkPipes(md);
  r = r.use(markdownItFootnote);
  r = markdownItWikilinkEmbed(r, workspace, parser, {
    getCurrentResource,
    createInnerMd: buildInner,
    renderContext,
    isVirtualWorkspace,
    getEmbedNoteType,
  });
  r = markdownItFoamTags(r, workspace);
  r = markdownItWikilinkNavigation(r, workspace, { linkResolver });
  r = markdownItRemoveLinkReferences(r, workspace);
  r = markdownItBlockAnchorIds(r);
  r = markdownItFoamQuery(r, workspace, graph, {
    isTrusted,
    toHref,
    getCurrentResource,
    createInnerMd: buildInner,
    parser,
    renderContext,
    onDidRender,
  });
  // Run host extensions LAST so they can override or wrap behaviour from the
  // base Foam plugins. Inner instances pick these up via the recursive call
  // in `buildInner` (the spread carries `extensions` along) — important for
  // the report renderer's image inliner, id-scoping, and link rewriting,
  // which must apply inside embedded notes too.
  if (extensions) {
    for (const ext of extensions) ext(r);
  }
  return r;
}
