import {
  ExportArtifactSet,
  FoamGraph,
  FoamWorkspace,
  PublishTarget,
  ResourceParser,
  URI,
} from '@foam/core';
import { renderReport, AttachmentReader, AttachmentLinkMode } from '../render-report';
import { commonPathBase } from '../slug';
import { htmlPageAssetStrategy } from './asset-strategy';
import { htmlPageLinkRewriter } from './link-rewriter';
import { createHtmlPageLocator } from './locator';

export interface HtmlPageTargetOptions {
  /** Title shown at the top of the report. */
  title: string;
  /** Generation timestamp embedded in the header (deterministic for tests). */
  generatedAt: Date;
  /** Workspace the pipeline (and renderer) read from. */
  workspace: FoamWorkspace;
  /** Graph used by the renderer for backlink + foam-query support. */
  graph: FoamGraph;
  /** Markdown parser shared with the workspace's resource provider. */
  parser: ResourceParser;
  /** URIs of every note that's in the export, in document order. */
  noteUris: URI[];
  /** Reads attachment bytes for inlining; returns null to leave a link alone. */
  readAttachment: AttachmentReader;
  /** How markdown links to attachments render. Defaults to `'ignore'`. */
  attachmentLinks?: AttachmentLinkMode;
  /** Callback invoked once `emit` has produced the HTML string. */
  onEmit: (html: string) => Promise<void>;
}

/**
 * `PublishTarget` for the single-file HTML report.
 *
 * Today's renderer (`renderReport`) is self-contained — it composes a
 * markdown-it instance with HTML-page-specific plugins and orchestrates the
 * whole HTML emission. `emit` calls it directly with the inputs the caller
 * provided at construction. The four `PublishTarget` slots (locator,
 * assetStrategy, linkRewriter, emit) are wired so the pipeline runs end-to-
 * end against the same interface Starlight uses.
 *
 * **Single-source-of-truth caveat.** The renderer currently computes its
 * own anchor strings (via `slugForUri`) instead of reading from
 * `context.locations`, so there are two anchor producers for the same notes.
 * They agree today because both use the same `slugForUri` helper, but a
 * future change to one without the other would silently break intra-doc
 * links. The fix is the source-level rewriting refactor tracked in
 * `.agent/tasks/export-html-page.md` ("Follow-up: converge with the existing
 * publish pipeline"); that work replaces `markdown-link-anchors.ts` with a
 * `SourceLinkRewriter` that reads from `context.locations` directly,
 * making the locator the single source of truth by construction.
 */
export class HtmlPageTarget implements PublishTarget {
  readonly locator;
  readonly assetStrategy = htmlPageAssetStrategy;
  readonly linkRewriter = htmlPageLinkRewriter;

  constructor(private readonly options: HtmlPageTargetOptions) {
    // `slugBase` is computed once from the input note URIs and handed to
    // the locator. The locator itself decides whether a URI is in-set by
    // reading `context.notes` at call time — no separately-tracked Set.
    this.locator = createHtmlPageLocator({
      slugBase: commonPathBase(options.noteUris),
    });
  }

  async emit(artifactSet: ExportArtifactSet): Promise<void> {
    // The artifact set is the pipeline's view of what to emit. Build the
    // per-URI markdown map renderReport expects.
    const noteContent = new Map<string, string>();
    for (const note of artifactSet.notes) {
      noteContent.set(note.sourceUri.toString(), note.markdown);
    }

    const noteUris = artifactSet.notes.map(n => n.sourceUri);

    const html = await renderReport({
      workspace: this.options.workspace,
      graph: this.options.graph,
      parser: this.options.parser,
      noteUris,
      noteContent,
      title: this.options.title,
      generatedAt: this.options.generatedAt,
      readAttachment: this.options.readAttachment,
      attachmentLinks: this.options.attachmentLinks,
    });

    await this.options.onEmit(html);
  }
}
