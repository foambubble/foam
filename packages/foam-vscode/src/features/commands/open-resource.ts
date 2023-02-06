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

interface OpenResourceArgs {
  filter: FilterDescriptor;
}

export const OPEN_COMMAND = {
  command: 'foam-vscode.open-resource',
  title: 'Foam: Open Resource',

  forURI: (uri: URI): CommandDescriptor<OpenResourceArgs> => {
    return {
      name: OPEN_COMMAND.command,
      params: {
        filter: {
          uri: uri,
        },
      },
    };
  },
};

async function openResource(workspace: FoamWorkspace, args?: OpenResourceArgs) {
  args = args ?? { filter: {} };

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

  const item =
    candidates.length === 1
      ? candidates[0]
      : await vscode.window.showQuickPick(
          candidates.map(createQuickPickItemForResource)
        );

  if (item) {
    const targetUri =
      item.uri.path === vscode.window.activeTextEditor?.document.uri.path
        ? vscode.window.activeTextEditor?.document.uri
        : toVsCodeUri(item.uri.asPlain());
    return vscode.commands.executeCommand('vscode.open', targetUri);
  }
}

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
      //   async (params: { uri: URI }) => {
      //     const uri = new URI(params.uri);
      //     switch (uri.scheme) {
      //       case 'file': {
      //         const targetUri =
      //           uri.path === vscode.window.activeTextEditor?.document.uri.path
      //             ? vscode.window.activeTextEditor?.document.uri
      //             : toVsCodeUri(uri.asPlain());
      //         return vscode.commands.executeCommand('vscode.open', targetUri);
      //       }
      //       case 'placeholder': {
      //         vscode.window.showErrorMessage(
      //           "Foam: Can't open placeholder. Use create-note command instead."
      //         );
      //       }
      //     }
      //   }
      // )
    );
  },
};

export default feature;
