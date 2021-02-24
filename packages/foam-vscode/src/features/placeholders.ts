import * as vscode from 'vscode';
import { Foam, Resource, isNote, isPlaceholder, isAttachment } from 'foam-core';
import {
  FilteredResourcesConfigGroupBy,
  getPlaceholdersConfig,
} from '../settings';
import { FoamFeature } from '../types';
import { FilteredResourcesProvider } from './filtered-resources';

const feature: FoamFeature = {
  activate: async (
    context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {
    const foam = await foamPromise;
    const workspacesURIs = vscode.workspace.workspaceFolders.map(
      dir => dir.uri
    );
    const provider = new FilteredResourcesProvider(
      foam.workspace,
      foam.services.dataStore,
      'placeholders',
      'placeholder',
      isPlaceholderResource,
      {
        ...getPlaceholdersConfig(),
        workspacesURIs,
      }
    );

    context.subscriptions.push(
      vscode.window.registerTreeDataProvider(
        'foam-vscode.placeholders',
        provider
      ),
      vscode.commands.registerCommand(
        'foam-vscode.group-placeholders-by-folder',
        () => provider.setGroupBy(FilteredResourcesConfigGroupBy.Folder)
      ),
      vscode.commands.registerCommand(
        'foam-vscode.group-placeholders-off',
        () => provider.setGroupBy(FilteredResourcesConfigGroupBy.Off)
      ),
      foam.workspace.onDidAdd(() => {
        provider.refresh();
        foam.workspace.resolveLinks();
      }),
      foam.workspace.onDidUpdate(() => {
        provider.refresh();
        foam.workspace.resolveLinks();
      }),
      foam.workspace.onDidDelete(() => {
        provider.refresh();
        foam.workspace.resolveLinks();
      })
    );
  },
};

export default feature;

export function isPlaceholderResource(resource: Resource) {
  if (isAttachment(resource)) {
    // We don't want to include attachments in this view, so we filter them out
    return false;
  }

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
