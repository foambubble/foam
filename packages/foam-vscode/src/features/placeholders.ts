import * as vscode from 'vscode';
import { Foam, Resource, isNote, isPlaceholder } from 'foam-core';
import { getPlaceholdersConfig } from '../settings';
import { FoamFeature } from '../types';
import { GroupedResourcesTreeDataProvider } from '../utils/grouped-resources-tree-data-provider';

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
      foam.workspace,
      foam.services.dataStore,
      'placeholders',
      'placeholder',
      isPlaceholderResource,
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

export function isPlaceholderResource(resource: Resource) {
  if (isPlaceholder(resource)) {
    // A placeholder is, by default, blank
    return true;
  }

  if (isNote(resource)) {
    const contentLines = resource.source.text
      .trim()
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .filter(line => !line.startsWith('#'));

    return contentLines.length === 0;
  }

  return false;
}
