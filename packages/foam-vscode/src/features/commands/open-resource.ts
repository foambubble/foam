import * as vscode from 'vscode';
import { FoamFeature } from '../../types';
import { URI } from '../../core/model/uri';
import { toVsCodeUri } from '../../utils/vsc-utils';
import { Foam } from '../../core/model/foam';
import {
  createFilter,
  FilterDescriptor,
} from '../../core/services/resource-filter';
import { CommandDescriptor } from '../../utils/commands';
import { FoamWorkspace } from '../../core/model/workspace';
import { Resource } from '../../core/model/note';
import { isSome, isNone } from '../../core/utils';
import { Logger } from '../../core/utils/log';

export interface OpenResourceArgs {
  /**
   * The URI of the resource to open.
   * If present the `filter` param is ignored
   */
  uri?: URI | string | vscode.Uri;

  /**
   * The filter object that describes which notes to consider
   * for opening
   */
  filter?: FilterDescriptor;
}

export const OPEN_COMMAND = {
  command: 'foam-vscode.open-resource',
  title: 'Foam: Open Resource',

  forURI: (uri: URI): CommandDescriptor<OpenResourceArgs> => {
    return {
      name: OPEN_COMMAND.command,
      params: {
        uri: uri,
      },
    };
  },
};

async function openResource(workspace: FoamWorkspace, args?: OpenResourceArgs) {
  args = args ?? {};

  let item: { uri: URI } | null = null;

  if (args.uri) {
    const path = typeof args.uri === 'string' ? args.uri : args.uri.path;
    item = workspace.find(path);
  }

  if (isNone(item) && args.filter) {
    const resources = workspace.list();
    const candidates = resources.filter(
      createFilter(args.filter, vscode.workspace.isTrusted)
    );

    if (candidates.length === 0) {
      vscode.window.showInformationMessage(
        'Foam: No note matches given filters.'
      );
      return;
    }

    item =
      candidates.length === 1
        ? candidates[0]
        : await vscode.window.showQuickPick(
            candidates.map(createQuickPickItemForResource)
          );
  }

  if (isSome(item)) {
    const targetUri =
      item.uri.path === vscode.window.activeTextEditor?.document.uri.path
        ? vscode.window.activeTextEditor?.document.uri
        : toVsCodeUri(item.uri.asPlain());
    return vscode.commands.executeCommand('vscode.open', targetUri);
  }
}

const feature: FoamFeature = {
  activate: async (
    context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {
    const foam = await foamPromise;
    context.subscriptions.push(
      vscode.commands.registerCommand(OPEN_COMMAND.command, args => {
        return openResource(foam.workspace, args);
      })
    );
  },
};

interface ResourceItem extends vscode.QuickPickItem {
  label: string;
  description: string;
  uri: URI;
  detail?: string;
}

const createQuickPickItemForResource = (resource: Resource): ResourceItem => {
  const icon = 'file';
  const sections = resource.sections
    .map(s => s.label)
    .filter(l => l !== resource.title);
  const detail = sections.length > 0 ? 'Sections: ' + sections.join(', ') : '';
  return {
    label: `$(${icon}) ${resource.title}`,
    description: vscode.workspace.asRelativePath(resource.uri.toFsPath()),
    uri: resource.uri,
    detail: detail,
  };
};

export default feature;
