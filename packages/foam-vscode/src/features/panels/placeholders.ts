import * as vscode from 'vscode';
import { Foam } from '../../core/model/foam';
import { createMatcherAndDataStore } from '../../services/editor';
import { getPlaceholdersConfig } from '../../settings';
import { FoamFeature } from '../../types';
import { GroupedResourcesTreeDataProvider } from '../../utils/grouped-resources-tree-data-provider';
import {
  ResourceRangeTreeItem,
  UriTreeItem,
  groupRangesByResource,
} from '../../utils/tree-view-utils';

const feature: FoamFeature = {
  activate: async (
    context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {
    const foam = await foamPromise;
    const { matcher } = await createMatcherAndDataStore(
      getPlaceholdersConfig().exclude
    );
    const provider = new GroupedResourcesTreeDataProvider(
      'placeholders',
      'placeholder',
      () => foam.graph.getAllNodes().filter(uri => uri.isPlaceholder()),
      uri => {
        return new UriTreeItem(uri, {
          icon: 'link',
          getChildren: async () => {
            return groupRangesByResource(
              foam.graph.getBacklinks(uri).map(link => {
                return ResourceRangeTreeItem.createStandardItem(
                  foam.workspace,
                  foam.workspace.get(link.source),
                  link.link.range
                );
              })
            );
          },
        });
      },
      matcher
    );
    provider.setGroupBy(getPlaceholdersConfig().groupBy);

    const treeView = vscode.window.createTreeView('foam-vscode.placeholders', {
      treeDataProvider: provider,
      showCollapseAll: true,
    });
    const baseTitle = treeView.title;
    treeView.title = baseTitle + ` (${provider.numElements})`;

    context.subscriptions.push(
      treeView,
      ...provider.commands,
      foam.graph.onDidUpdate(() => {
        provider.refresh();
        treeView.title = baseTitle + ` (${provider.numElements})`;
      })
    );
  },
};

export default feature;
