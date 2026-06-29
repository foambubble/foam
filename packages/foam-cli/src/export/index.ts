import { createExportContext } from './bootstrap/create-context';
import { buildExportedGraph } from './derive/build-site-graph';
import { buildExportedSite } from './derive/build-site-metadata';
import { transformNote } from './transform/transform-note';
import { ExportArtifactSet, ExportConfig } from './types';

export * from './types';
export * from './asset-filters';

export const buildSite = async (
  config: ExportConfig
): Promise<ExportArtifactSet> => {
  const context = createExportContext(config);
  const transformedNotes = await Promise.all(
    context.notes.map(note => transformNote(note, context))
  );
  const notes = transformedNotes.map(result => result.note);
  const diagnostics = transformedNotes.flatMap(result => result.diagnostics);

  return {
    site: buildExportedSite(context, context.notes, context.exportedRoutes),
    graph: buildExportedGraph(context, context.notes, context.exportedRoutes),
    notes,
    assets: context.exportedAssets,
    routes: context.exportedRoutes,
    diagnostics,
  };
};
