import type { Resource, ResourceLink } from '../model/note';
import type { TextEdit } from '../services/text-edit';
import type { URI } from '../model/uri';
import type { ExportArtifactSet, ExportContext } from './types';

/**
 * Where each note lives in the target's output address space.
 *
 * `href` is what goes into `<a href="…">` for a link to the note (no section).
 * `sectionAnchor` / `sectionId` must agree (modulo the `#` prefix): they're a
 * pair the target controls together so they can't drift. Targets implement
 * both via one private helper so the scoping scheme stays in one place.
 */
export interface PublishLocation {
  /** What goes into `href="…"` for a link to this note. */
  href: string;
  /** What goes into `href="…"` for a link to a specific section of this note. */
  sectionAnchor(slug: string): string;
  /** What goes onto the section heading's `id="…"` attribute. */
  sectionId(slug: string): string;
}

/**
 * Resolves URIs to output addresses. One per target.
 *
 * **Phase invariant — read carefully.** The pipeline calls `locate` once
 * per selected note, building up `context.locations` as it goes. During
 * your own call, `context.locations` and `context.assetResolutions` are
 * still being populated (or empty) — do NOT read from them. Locators
 * should derive their result only from `(uri, context.workspace,
 * context.graph, context.contentRoot)`. Cross-note resolution (e.g.
 * "compute my route relative to my parent's") is not supported in this
 * phase; defer such logic to the link rewriter or emit step, where the
 * full `context.locations` map is guaranteed to be populated.
 */
export interface PublishLocator {
  locate(uri: URI, context: ExportContext): PublishLocation | null;
}

/**
 * Decides how each referenced asset is materialised in the output.
 *
 * - `file`: write the asset to `outputPath` and link to it.
 * - `inline`: the asset is embedded into the document (typically as a
 *   `data:` URI). The actual byte-loading + URI computation happens at
 *   emit time — `resolve()` only signals intent. Targets that materialise
 *   inline assets do so in their own `emit` implementation.
 * - `skip`: drop the link entirely.
 */
export type AssetResolution =
  | { kind: 'file'; outputPath: string }
  | { kind: 'inline' }
  | { kind: 'skip' };

/**
 * **Phase invariant.** Asset strategies run after the locator phase, so
 * `context.locations` is fully populated and safe to read. However,
 * `context.assetResolutions` is still being populated during the asset
 * pass — do NOT read it from within `resolve`. If a strategy needs to
 * know "is this asset linked from a specific kind of note", it can read
 * `context.locations`; cross-asset decisions belong in emit.
 */
export interface AssetStrategy {
  resolve(asset: Resource, context: ExportContext): AssetResolution;
}

/**
 * A link the pipeline has already resolved against the artifact set.
 *
 * - `in-set`: the link resolves to a note that's part of this export.
 *             `location` is the target's PublishLocation for that note.
 * - `in-set-asset`: the link resolves to an asset the target keeps.
 *                   `assetResolution` is the materialisation decision.
 * - `excluded`: the link resolved to a real resource that this export
 *               doesn't include (filtered out by `include` or out of
 *               content scope).
 * - `unresolved`: the link is dangling (no matching workspace resource).
 */
export interface ResolvedLink {
  original: ResourceLink;
  resolution:
    | { kind: 'in-set'; targetResource: Resource; location: PublishLocation }
    | {
        kind: 'in-set-asset';
        targetResource: Resource;
        assetResolution: AssetResolution;
      }
    | { kind: 'excluded'; targetResource: Resource }
    | { kind: 'unresolved'; targetPath: string };
  /**
   * Section/fragment portion of the link, if any. Targets that emit
   * scoped section ids use `location.sectionAnchor(section)`.
   */
  section: string | undefined;
}

/**
 * Result of a link-rewrite decision. Source-level: the rewriter returns
 * a `TextEdit` against the markdown source, or signals that the link
 * should be left as-is (Foam's default markdown still works).
 */
export type LinkRewriteResult =
  | { kind: 'edit'; edit: TextEdit }
  | { kind: 'leave' };

export interface SourceLinkRewriter {
  rewrite(
    link: ResolvedLink,
    note: Resource,
    context: ExportContext
  ): LinkRewriteResult;
}

/**
 * A target plugs four concerns into the pipeline:
 *
 *  1. `locator` — where notes live in the output.
 *  2. `assetStrategy` — how assets are materialised.
 *  3. `linkRewriter` — how cross-note links are emitted.
 *  4. `emit` — final materialisation of the artifact set.
 *
 * Target-specific configuration (output dir, site URL, title, etc.) is
 * constructed into the target instance, not passed through the pipeline.
 */
export interface PublishTarget {
  locator: PublishLocator;
  assetStrategy: AssetStrategy;
  linkRewriter: SourceLinkRewriter;
  emit(artifactSet: ExportArtifactSet): Promise<void>;
}
