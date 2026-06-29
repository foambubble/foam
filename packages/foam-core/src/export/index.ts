import { createExportContext } from './bootstrap/create-context';
import { buildExportedGraph } from './derive/build-site-graph';
import { buildExportedSite } from './derive/build-site-metadata';
import type { PublishTarget } from './target';
import { transformNote } from './transform/transform-note';
import {
  ExportArtifactSet,
  ExportConfig,
  ExportContext,
  ExportedAsset,
  ExportedRoute,
} from './types';

export * from './types';
export * from './asset-filters';
export * from './target';

/**
 * Runs the export pipeline against a target.
 *
 *  1. Selects notes + linked assets from the workspace.
 *  2. Asks `target.locator` where each note lives in the output.
 *  3. Asks `target.assetStrategy` how each asset is materialised.
 *  4. Asks `target.linkRewriter` how cross-note links are emitted.
 *  5. Hands the artifact set to `target.emit` for final materialisation.
 *
 * Returns the artifact set (notes, assets, routes, diagnostics) so callers
 * can inspect what was emitted — e.g. to log diagnostics or summarise.
 */
export const buildSite = async (
  config: ExportConfig,
  target: PublishTarget
): Promise<ExportArtifactSet> => {
  const context = createExportContext(config, target);
  const transformedNotes = await Promise.all(
    context.notes.map(note => transformNote(note, context, target.linkRewriter))
  );
  const notes = transformedNotes.map(result => result.note);
  const diagnostics = transformedNotes.flatMap(result => result.diagnostics);

  const routes = materialiseRoutes(context);
  const assets = materialiseAssets(context);

  const artifactSet: ExportArtifactSet = {
    site: buildExportedSite(context, context.notes, routes),
    graph: buildExportedGraph(context, context.notes, routes),
    notes,
    assets,
    routes,
    diagnostics,
  };

  await target.emit(artifactSet);

  return artifactSet;
};

/**
 * Flattens `context.locations` into the public `routes` shape. One entry
 * per note that the target located, in **selection order** (preserves
 * the order the selector handed back to the pipeline, same order as
 * `artifactSet.notes`).
 */
const materialiseRoutes = (context: ExportContext): ExportedRoute[] =>
  context.notes
    .map(note => {
      const location = context.locations.get(note.uri.path);
      return location
        ? { sourceUri: note.uri, route: location.href }
        : null;
    })
    .filter((entry): entry is ExportedRoute => entry !== null);

/**
 * Flattens `context.assetResolutions` into the public `assets` shape.
 * Only `file`-kind resolutions surface here — `inline` assets are embedded
 * into note markdown by the target's emit step (no separate output file),
 * and `skip` assets are dropped entirely. Entries are in **asset-discovery
 * order**: the order assets were first encountered by walking the selected
 * notes' links (which themselves are in selection order).
 */
const materialiseAssets = (context: ExportContext): ExportedAsset[] =>
  context.assets
    .map(asset => {
      const resolution = context.assetResolutions.get(asset.uri.path);
      if (!resolution || resolution.kind !== 'file') return null;
      return { sourceUri: asset.uri, outputPath: resolution.outputPath };
    })
    .filter((entry): entry is ExportedAsset => entry !== null);
