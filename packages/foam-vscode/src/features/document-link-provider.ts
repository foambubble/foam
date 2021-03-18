import * as vscode from 'vscode';
import { Foam, FoamWorkspace, NoteParser, uris } from 'foam-core';
import { FoamFeature } from '../types';
import { isNote, mdDocSelector } from '../utils';
import { OPEN_COMMAND } from './utility-commands';
import { toVsCodeRange, toVsCodeUri } from '../utils/vsc-utils';

const feature: FoamFeature = {
  activate: async (
    context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {
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
  constructor(private workspace: FoamWorkspace, private parser: NoteParser) {}

  public provideDocumentLinks(
    document: vscode.TextDocument
  ): vscode.DocumentLink[] {
    const resource = this.parser.parse(document.uri, document.getText());

    if (isNote(resource)) {
      return resource.links.map(link => {
        const target = this.workspace.resolveLink(resource, link);
        const command = OPEN_COMMAND.asURI(toVsCodeUri(target));
        const documentLink = new vscode.DocumentLink(
          toVsCodeRange(link.range),
          command
        );
        documentLink.tooltip = uris.isPlaceholder(target)
          ? `Create note for '${target.path}'`
          : `Go to ${uris.toFsPath(target)}`;
        return documentLink;
      });
    }
    return [];
  }
}

export default feature;
