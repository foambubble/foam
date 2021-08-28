import * as vscode from 'vscode';
import { Foam, FoamWorkspace, ResourceParser, URI, Range } from 'foam-core';
import { FoamFeature } from '../types';
import { getNoteTooltip, mdDocSelector, isSome } from '../utils';
import { toVsCodeRange } from '../utils/vsc-utils';
import { ResourceLink } from 'foam-core';
import { getFoamVsCodeConfig } from '../services/config';

const feature: FoamFeature = {
  activate: async (
    context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {
    if (!getFoamVsCodeConfig('links.hover.enable')) {
      return;
    }

    const foam = await foamPromise;

    context.subscriptions.push(
      vscode.languages.registerHoverProvider(
        mdDocSelector,
        new HoverProvider(foam.workspace, foam.services.parser)
      )
    );
  },
};

export class HoverProvider implements vscode.HoverProvider {
  constructor(
    private workspace: FoamWorkspace,
    private parser: ResourceParser
  ) {}

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Hover> {
    const startResource = this.parser.parse(document.uri, document.getText());

    const targetLink: ResourceLink | undefined = startResource.links.find(
      link =>
        link.type === 'wikilink' &&
        Range.containsPosition(link.range, {
          line: position.line,
          character: position.character,
        })
    );
    if (!targetLink) {
      return;
    }

    const targetUri = this.workspace.resolveLink(startResource, targetLink);
    if (URI.isPlaceholder(targetUri)) {
      return;
    }

    const resultP: Promise<
      vscode.Hover | undefined
    > = this.workspace.readAsMarkdown(targetUri).then(
      content => {
        const md = isSome(content)
          ? getNoteTooltip(content)
          : this.workspace.get(targetUri).title;
        const hover: vscode.Hover = {
          contents: [md],
          range: toVsCodeRange(targetLink.range),
        };
        return hover;
      },
      err => {
        return undefined;
      }
    );

    return resultP;
  }
}

export default feature;
