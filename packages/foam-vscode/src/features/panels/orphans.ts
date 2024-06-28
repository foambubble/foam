import * as vscode from 'vscode';
import { Foam } from '../../core/model/foam';
import { createMatcherAndDataStore } from '../../services/editor';
import { getAttachmentsExtensions } from '../../settings';
import {
  GroupedResourcesConfig,
  GroupedResourcesTreeDataProvider,
} from './utils/grouped-resources-tree-data-provider';
import { ResourceTreeItem, UriTreeItem } from './utils/tree-view-utils';
import { IMatcher } from '../../core/services/datastore';
import { FoamWorkspace } from '../../core/model/workspace';
import { FoamGraph } from '../../core/model/graph';
import { URI } from '../../core/model/uri';
import { imageExtensions } from '../../core/services/attachment-provider';

const EXCLUDE_TYPES = ['image', 'attachment'];
export default async function activate(
  context: vscode.ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const foam = await foamPromise;

  const { matcher } = await createMatcherAndDataStore(
    getOrphansConfig().exclude
  );
  const provider = new OrphanTreeView(
    context.globalState,
    foam.workspace,
    foam.graph,
    matcher
  );

  const treeView = vscode.window.createTreeView('foam-vscode.orphans', {
    treeDataProvider: provider,
    showCollapseAll: true,
  });
  provider.refresh();
  const baseTitle = treeView.title;
  treeView.title = baseTitle + ` (${provider.nValues})`;

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('foam-vscode.orphans', provider),
    provider,
    treeView,
    foam.graph.onDidUpdate(() => {
      provider.refresh();
      treeView.title = baseTitle + ` (${provider.nValues})`;
    })
  );
}

/** Retrieve the orphans configuration */
export function getOrphansConfig(): GroupedResourcesConfig {
  const orphansConfig = vscode.workspace.getConfiguration('foam.orphans');
  const exclude: string[] = orphansConfig.get('exclude');
  return { exclude };
}

export class OrphanTreeView extends GroupedResourcesTreeDataProvider {
  constructor(
    state: vscode.Memento,
    private workspace: FoamWorkspace,
    private graph: FoamGraph,
    matcher: IMatcher
  ) {
    super('orphans', state, matcher);
  }

  createValueTreeItem = uri => {
    return uri.isPlaceholder()
      ? new UriTreeItem(uri)
      : new ResourceTreeItem(this.workspace.find(uri), this.workspace);
  };

  getUris = () =>
    this.graph
      .getAllNodes()
      .filter(
        uri =>
          !EXCLUDE_TYPES.includes(this.workspace.find(uri)?.type) &&
          this.graph.getBacklinks(uri).length === 0 &&
          this.graph.getLinks(uri).filter(c => !isAttachment(c.target))
            .length === 0
      );
}

function isAttachment(uri: URI) {
  const ext = [...getAttachmentsExtensions(), ...imageExtensions];
  return ext.includes(uri.getExtension());
}
