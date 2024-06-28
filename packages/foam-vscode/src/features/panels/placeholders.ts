import * as vscode from 'vscode';
import { Foam } from '../../core/model/foam';
import { createMatcherAndDataStore } from '../../services/editor';
import {
  GroupedResourcesConfig,
  GroupedResourcesTreeDataProvider,
} from './utils/grouped-resources-tree-data-provider';
import {
  UriTreeItem,
  createBacklinkItemsForResource,
  expandAll,
  groupRangesByResource,
} from './utils/tree-view-utils';
import { IMatcher } from '../../core/services/datastore';
import { ContextMemento, fromVsCodeUri } from '../../utils/vsc-utils';
import { FoamGraph } from '../../core/model/graph';
import { URI } from '../../core/model/uri';
import { FoamWorkspace } from '../../core/model/workspace';
import { FolderTreeItem } from './utils/folder-tree-provider';

/** Retrieve the placeholders configuration */
export function getPlaceholdersConfig(): GroupedResourcesConfig {
  const placeholderCfg = vscode.workspace.getConfiguration('foam.placeholders');
  const exclude: string[] = placeholderCfg.get('exclude');
  return { exclude };
}

export default async function activate(
  context: vscode.ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const foam = await foamPromise;
  const { matcher } = await createMatcherAndDataStore(
    getPlaceholdersConfig().exclude
  );
  const provider = new PlaceholderTreeView(
    context.globalState,
    foam.workspace,
    foam.graph,
    matcher
  );

  const treeView = vscode.window.createTreeView('foam-vscode.placeholders', {
    treeDataProvider: provider,
    showCollapseAll: true,
  });
  provider.refresh();
  const baseTitle = treeView.title;
  treeView.title = baseTitle + ` (${provider.nValues})`;

  context.subscriptions.push(
    treeView,
    provider,
    foam.graph.onDidUpdate(() => {
      provider.refresh();
    }),
    provider.onDidChangeTreeData(() => {
      treeView.title = baseTitle + ` (${provider.nValues})`;
    }),
    vscode.commands.registerCommand(
      `foam-vscode.views.placeholders.expand-all`,
      () =>
        expandAll(
          treeView,
          provider,
          node =>
            node.contextValue === 'placeholder' ||
            node.contextValue === 'folder'
        )
    ),
    vscode.window.onDidChangeActiveTextEditor(() => {
      if (provider.show.get() === 'for-current-file') {
        provider.refresh();
      }
    })
  );
}

export class PlaceholderTreeView extends GroupedResourcesTreeDataProvider {
  public show = new ContextMemento<'all' | 'for-current-file'>(
    this.state,
    `foam-vscode.views.${this.providerId}.show`,
    'all'
  );

  public constructor(
    state: vscode.Memento,
    private workspace: FoamWorkspace,
    private graph: FoamGraph,
    matcher: IMatcher
  ) {
    super('placeholders', state, matcher);
    this.disposables.push(
      vscode.commands.registerCommand(
        `foam-vscode.views.${this.providerId}.show:all`,
        () => {
          this.show.update('all');
          this.refresh();
        }
      ),
      vscode.commands.registerCommand(
        `foam-vscode.views.${this.providerId}.show:for-current-file`,
        () => {
          this.show.update('for-current-file');
          this.refresh();
        }
      )
    );
  }

  createValueTreeItem(uri: URI, parent: FolderTreeItem<URI>): UriTreeItem {
    const item = new UriTreeItem(uri, {
      parent,
      collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
    });
    item.contextValue = 'placeholder';
    item.id = uri.toString();
    item.getChildren = async () => {
      return groupRangesByResource(
        this.workspace,
        await createBacklinkItemsForResource(
          this.workspace,
          this.graph,
          uri,
          'link'
        )
      );
    };
    return item;
  }

  getUris(): URI[] {
    if (this.show.get() === 'for-current-file') {
      const currentFile = vscode.window.activeTextEditor?.document.uri;
      return currentFile
        ? this.graph
            .getLinks(fromVsCodeUri(currentFile))
            .map(link => link.target)
            .filter(uri => uri.isPlaceholder())
        : [];
    }
    return this.graph.getAllNodes().filter(uri => uri.isPlaceholder());
  }
}
