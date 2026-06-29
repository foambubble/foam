import { FoamGraph } from '../../model/graph';
import { Resource, ResourceLink } from '../../model/note';
import { URI } from '../../model/uri';
import { FoamWorkspace } from '../../model/workspace';
import { isWithinPath } from '../../utils/path';
import { getIncludeAssetMatcher } from '../config';
import { selectAll } from '../selectors';
import type {
  AssetResolution,
  PublishLocation,
  PublishTarget,
} from '../target';
import {
  ExportAssetMatcher,
  ExportConfig,
  ExportContext,
} from '../types';

const resolveContentRoot = (config: ExportConfig): URI | null => {
  if (!config.contentRoot) {
    return null;
  }

  if (config.contentRoot instanceof URI) {
    return config.contentRoot.asPlain();
  }

  return config.workspace.resolveUri(config.contentRoot).asPlain();
};

const isExportableAssetLink = (link: ResourceLink) =>
  link.type === 'wikilink' || link.type === 'link';

const collectLinkedAssets = (
  notes: Resource[],
  graph: FoamGraph,
  workspace: FoamWorkspace,
  contentRoot: URI | null,
  includeAsset: ExportAssetMatcher
): Resource[] => {
  // Assets enter the export graph only if an exported note links to them.
  const assets = new Map<string, Resource>();
  const linkedFromByAsset = new Map<string, Resource[]>();

  notes.forEach(note => {
    note.links.forEach(link => {
      if (!isExportableAssetLink(link)) {
        return;
      }

      const resolvedUri = workspace.resolveLink(note, link).asPlain();
      if (resolvedUri.isPlaceholder()) {
        return;
      }

      const resource = workspace.find(resolvedUri);
      if (!resource || resource.type === 'note') {
        return;
      }

      const linkedFrom = linkedFromByAsset.get(resource.uri.path) ?? [];
      if (!linkedFrom.some(candidate => candidate.uri.isEqual(note.uri))) {
        linkedFrom.push(note);
        linkedFromByAsset.set(resource.uri.path, linkedFrom);
      }

      if (
        !includeAsset(resource, {
          workspace,
          graph,
          contentRoot,
          exportedNotes: notes,
          linkedFrom,
        })
      ) {
        return;
      }

      assets.set(resource.uri.path, resource);
    });
  });

  return Array.from(assets.values());
};

export const createExportContext = (
  config: ExportConfig,
  target: PublishTarget
): ExportContext => {
  const graph = config.graph ?? FoamGraph.fromWorkspace(config.workspace);
  const includeAssetMatcher = getIncludeAssetMatcher(config);
  const contentRoot = resolveContentRoot(config);
  const runtimeContext = {
    workspace: config.workspace,
    graph,
    contentRoot,
  };

  // The caller hands us an ordered list of notes. The pipeline preserves that
  // order. `contentRoot` (if set) further scopes whatever the selector produced
  const selector = config.select ?? selectAll();
  const notes = selector(config.workspace, graph).filter(resource => {
    if (resource.type !== 'note') return false;
    if (contentRoot && !isWithinPath(resource.uri.asPlain(), contentRoot)) {
      return false;
    }
    return true;
  });

  // Derived predicate used by downstream code (backlinks, etc.) to decide
  // whether a Resource is in the export. It's now strictly "is this note
  // in the selected set", not a user-supplied matcher.
  const selectedByPath = new Set(notes.map(n => n.uri.path));
  const include = (resource: Resource): boolean =>
    selectedByPath.has(resource.uri.path);

  const linkedAssets = collectLinkedAssets(
    notes,
    graph,
    config.workspace,
    contentRoot,
    includeAssetMatcher
  );
  const resources = [...notes, ...linkedAssets];

  // Two-phase context construction: build a shell with empty maps, hand
  // it to the locator (phase 1) which populates `locations`, then to the
  // asset strategy (phase 2) which populates `assetResolutions`. Hooks
  // see the in-progress context — see the phase-invariant docs on
  // `PublishLocator.locate` and `AssetStrategy.resolve` in target.ts for
  // what each phase may safely read.
  const context: ExportContext = {
    ...runtimeContext,
    site: config.site,
    include,
    resources,
    notes,
    assets: linkedAssets,
    locations: new Map<string, PublishLocation>(),
    assetResolutions: new Map<string, AssetResolution>(),
  };

  // Phase 1: locator. `context.locations` is being built up here, so a
  // locator that reads it during its own pass sees partial state — don't.
  for (const note of notes) {
    const location = target.locator.locate(note.uri, context);
    if (location) {
      context.locations.set(note.uri.path, location);
    }
  }

  // Phase 2: asset strategy. `context.locations` is now fully populated;
  // `context.assetResolutions` is being built up here — same caveat as above.
  for (const asset of linkedAssets) {
    context.assetResolutions.set(
      asset.uri.path,
      target.assetStrategy.resolve(asset, context)
    );
  }

  return context;
};
