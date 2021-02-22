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
    const workspacesFsPaths = vscode.workspace.workspaceFolders.map(
      dir => dir.uri.fsPath
    );
    const provider = new FilteredResourcesProvider(
      foam.workspace,
      foam.services.dataStore,
      'placeholders',
      'placeholder',
      isPlaceholderResource,
      {
        ...getPlaceholdersConfig(),
        workspacesFsPaths,
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
    // A note with no source text is blank
    if (!resource.source.text) {
      return true;
    }

    const trimmedText = resource.source.text.trim();
    const lines = trimmedText.split('\n').map(line => line.trim());
    const noLines = lines.length === 0;

    // A note with no lines of content is blank
    if (noLines) {
      return true;
    }

    if (lines.length === 1) {
      const onlyLineIsEmpty = lines[0].length === 0;

      // A note where the only line is empty is blank
      if (onlyLineIsEmpty) {
        return true;
      }

      const onlyLineIsTitle = !!/^#.*/gm.exec(lines[0]);

      // A note where the only line is a title is blank
      if (onlyLineIsTitle) {
        return true;
      }
    }
  }

  return false;
}
