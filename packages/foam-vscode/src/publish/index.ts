import { createPublishContext } from './bootstrap/create-context';
import { buildPublishedGraph } from './derive/build-site-graph';
import { buildPublishedSite } from './derive/build-site-metadata';
import { transformNote } from './transform/transform-note';
import { PublishArtifactSet, PublishConfig } from './types';

export * from './types';
export * from './asset-filters';

export const buildSite = async (
  config: PublishConfig
): Promise<PublishArtifactSet> => {
  const context = createPublishContext(config);
  const transformedNotes = await Promise.all(
    context.notes.map(note => transformNote(note, context))
  );
  const notes = transformedNotes.map(result => result.note);
  const diagnostics = transformedNotes.flatMap(result => result.diagnostics);

  return {
    site: buildPublishedSite(context, context.notes, context.publishedRoutes),
    graph: buildPublishedGraph(context, context.notes, context.publishedRoutes),
    notes,
    assets: context.publishedAssets,
    routes: context.publishedRoutes,
    diagnostics,
  };
};
