import * as vscode from 'vscode';
import { Foam } from '../../core/model/foam';
import { createMatcherAndDataStore } from '../../services/editor';
import { getPlaceholdersConfig } from '../../settings';
import { FoamFeature } from '../../types';
import {
  GroupedResourcesTreeDataProvider,
  UriTreeItem,
} from '../../utils/grouped-resources-tree-data-provider';

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
        return new UriTreeItem(uri);
      },
      matcher
    );
    provider.setGroupBy(getPlaceholdersConfig().groupBy);

    context.subscriptions.push(
      vscode.window.registerTreeDataProvider(
        'foam-vscode.placeholders',
        provider
      ),
      ...provider.commands,
      foam.graph.onDidUpdate(() => provider.refresh())
    );
  },
};

export default feature;
