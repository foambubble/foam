import * as vscode from 'vscode';
import { URI } from '../core/model/uri';
import { FoamFeature } from '../types';
import { mdDocSelector } from '../utils';
import { OPEN_COMMAND } from './utility-commands';
import { fromVsCodeUri, toVsCodeRange, toVsCodeUri } from '../utils/vsc-utils';
import { getFoamVsCodeConfig } from '../services/config';
import { Foam } from '../core/model/foam';
import { FoamWorkspace } from '../core/model/workspace';
import { ResourceParser } from '../core/model/note';

const feature: FoamFeature = {
  activate: async (
    context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {
    if (!getFoamVsCodeConfig('links.navigation.enable')) {
      return;
    }

    const foam = await foamPromise;

    context.subscriptions.push(
      vscode.languages.registerDocumentLinkProvider(
        mdDocSelector,
        new LinkProvider(foam.workspace, foam.services.parser)
      )
    );
  },
};

export class LinkProvider implements vscode.DocumentLinkProvider {
  constructor(
    private workspace: FoamWorkspace,
    private parser: ResourceParser
  ) {}

  public provideDocumentLinks(
    document: vscode.TextDocument
  ): vscode.DocumentLink[] {
    const resource = this.parser.parse(
      fromVsCodeUri(document.uri),
      document.getText()
    );

    return resource.links.map(link => {
      const target = this.workspace.resolveLink(resource, link);
      const command = OPEN_COMMAND.asURI(target);
      const documentLink = new vscode.DocumentLink(
        toVsCodeRange(link.range),
        command
      );
      documentLink.tooltip = URI.isPlaceholder(target)
        ? `Create note for '${target.path}'`
        : `Go to ${URI.toFsPath(target)}`;
      return documentLink;
    });
  }
}

export default feature;
