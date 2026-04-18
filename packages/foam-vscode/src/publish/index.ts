import { createPublishContext } from './bootstrap/create-context';
import { collectPublishedNotes, collectPublishedResources } from './collect/collect-notes';
import { buildAssetManifest, buildRouteManifest } from './derive/build-route-manifest';
import { transformNote } from './transform/transform-note';
import { PublishArtifactSet, PublishConfig } from './types';

export * from './types';

export const buildSite = async (
  config: PublishConfig
): Promise<PublishArtifactSet> => {
  const context = createPublishContext(config);
  const resources = collectPublishedResources(context);
  const notes = await Promise.all(
    collectPublishedNotes(context).map(note => transformNote(note, context))
  );

  return {
    notes,
    assets: buildAssetManifest(resources, context.workspace),
    routes: buildRouteManifest(resources, context.workspace),
  };
};
