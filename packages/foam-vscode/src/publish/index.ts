import { createPublishContext } from './bootstrap/create-context';
import { collectPublishedNotes, collectPublishedResources } from './collect/collect-notes';
import { buildAssetManifest, buildRouteManifest } from './derive/build-route-manifest';
import { buildPublishedSite } from './derive/build-site-metadata';
import { transformNote } from './transform/transform-note';
import { PublishArtifactSet, PublishConfig } from './types';

export * from './types';
export * from './asset-filters';

export const buildSite = async (
  config: PublishConfig
): Promise<PublishArtifactSet> => {
  const context = createPublishContext(config);
  const resources = collectPublishedResources(context);
  const noteResources = collectPublishedNotes(context);
  const routes = buildRouteManifest(
    resources,
    context.workspace,
    context.contentRoot
  );
  const transformedNotes = await Promise.all(
    noteResources.map(note => transformNote(note, context))
  );
  const notes = transformedNotes.map(result => result.note);
  const diagnostics = transformedNotes.flatMap(result => result.diagnostics);

  return {
    site: buildPublishedSite(context, noteResources, routes),
    notes,
    assets: buildAssetManifest(resources, context.workspace),
    routes,
    diagnostics,
  };
};
