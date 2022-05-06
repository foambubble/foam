import * as vscode from 'vscode';
import { Foam } from '../core/model/foam';
import { URI } from '../core/model/uri';
import { FoamWorkspace } from '../core/model/workspace';
import { getPlaceholdersConfig } from '../settings';
import { FoamFeature } from '../types';
import {
  GroupedResourcesTreeDataProvider,
  ResourceTreeItem,
  UriTreeItem,
} from '../utils/grouped-resources-tree-data-provider';
import { fromVsCodeUri } from '../utils/vsc-utils';

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
      () =>
        foam.graph
          .getAllNodes()
          .filter(uri => isPlaceholderResource(uri, foam.workspace)),
      uri => {
        if (uri.isPlaceholder()) {
          return new UriTreeItem(uri);
        }
        const resource = foam.workspace.find(uri);
        return new ResourceTreeItem(resource, foam.workspace);
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

export function isPlaceholderResource(uri: URI, workspace: FoamWorkspace) {
  if (uri.isPlaceholder()) {
    return true;
  }

  const resource = workspace.find(uri);
  const contentLines =
    resource?.source.text
      .trim()
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .filter(line => !line.startsWith('#')) ?? '';

  return contentLines.length === 0;
}
