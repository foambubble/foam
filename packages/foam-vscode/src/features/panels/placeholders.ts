import * as vscode from 'vscode';
import { Foam } from '../../core/model/foam';
import { getPlaceholdersConfig } from '../../settings';
import { FoamFeature } from '../../types';
import {
  GroupedResourcesTreeDataProvider,
  UriTreeItem,
} from '../../utils/grouped-resources-tree-data-provider';
import { fromVsCodeUri } from '../../utils/vsc-utils';

const feature: FoamFeature = {
  activate: async (
    context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {
    const foam = await foamPromise;
    const workspacesURIs = vscode.workspace.workspaceFolders.map(dir =>
      fromVsCodeUri(dir.uri)
    );
    const provider = new GroupedResourcesTreeDataProvider(
      'placeholders',
      'placeholder',
      getPlaceholdersConfig(),
      workspacesURIs,
      () => foam.graph.getAllNodes().filter(uri => uri.isPlaceholder()),
      uri => {
        return new UriTreeItem(uri);
      }
    );

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
