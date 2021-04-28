import * as vscode from 'vscode';
import { Foam, FoamWorkspace, Resource, URI } from 'foam-core';
import { getPlaceholdersConfig } from '../settings';
import { FoamFeature } from '../types';
import {
  GroupedResourcesTreeDataProvider,
  ResourceTreeItem,
  UriTreeItem,
} from '../utils/grouped-resources-tree-data-provider';

const feature: FoamFeature = {
  activate: async (
    context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {
    const foam = await foamPromise;
    const workspacesURIs = vscode.workspace.workspaceFolders.map(
      dir => dir.uri
    );
    const provider = new GroupedResourcesTreeDataProvider(
      'placeholders',
      'placeholder',
      () =>
        foam.graph
          .getAllNodes()
          .filter(uri => isPlaceholderResource(uri, foam.workspace)),
      uri =>
        URI.isPlaceholder(uri)
          ? new UriTreeItem(uri)
          : new ResourceTreeItem(foam.workspace.find(uri), foam.workspace),
      getPlaceholdersConfig(),
      workspacesURIs
    );

    context.subscriptions.push(
      vscode.window.registerTreeDataProvider(
        'foam-vscode.placeholders',
        provider
      ),
      ...provider.commands,
      foam.workspace.onDidAdd(() => provider.refresh()),
      foam.workspace.onDidUpdate(() => provider.refresh()),
      foam.workspace.onDidDelete(() => provider.refresh())
    );
  },
};

export default feature;

export function isPlaceholderResource(uri: URI, workspace: FoamWorkspace) {
  if (URI.isPlaceholder(uri)) {
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
