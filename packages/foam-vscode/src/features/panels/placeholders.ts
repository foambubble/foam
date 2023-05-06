import * as vscode from 'vscode';
import { Foam } from '../../core/model/foam';
import { createMatcherAndDataStore } from '../../services/editor';
import { getPlaceholdersConfig } from '../../settings';
import { GroupedResourcesTreeDataProvider } from './utils/grouped-resources-tree-data-provider';
import {
  UriTreeItem,
  createBacklinkItemsForResource,
  groupRangesByResource,
} from './utils/tree-view-utils';
import { IMatcher } from '../../core/services/datastore';
import { ContextMemento, fromVsCodeUri } from '../../utils/vsc-utils';
import { FoamGraph } from '../../core/model/graph';
import { URI } from '../../core/model/uri';
import { FoamWorkspace } from '../../core/model/workspace';

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
  const baseTitle = treeView.title;
  treeView.title = baseTitle + ` (${provider.numElements})`;
  provider.refresh();

  context.subscriptions.push(
    treeView,
    provider,
    foam.graph.onDidUpdate(() => {
      provider.refresh();
    }),
    provider.onDidChangeTreeData(() => {
      treeView.title = baseTitle + ` (${provider.numElements})`;
    }),
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
    super('placeholders', 'placeholder', state, matcher);
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

  createTreeItem = uri => {
    const item = new UriTreeItem(uri, {
      collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
    });
    item.getChildren = async () => {
      return groupRangesByResource(
        this.workspace,
        createBacklinkItemsForResource(this.workspace, this.graph, uri)
      );
    };
    item.iconPath = new vscode.ThemeIcon('link');
    return item;
  };

  computeResources = (): URI[] => {
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
  };
}
