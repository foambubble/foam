import * as vscode from 'vscode';
import { Foam, FoamWorkspace, ResourceParser, URI, Range } from 'foam-core';
import { FoamFeature } from '../types';
import { getNoteTooltip, mdDocSelector, isSome } from '../utils';
import { toVsCodeRange } from '../utils/vsc-utils';
import { ResourceLink } from 'foam-core';
import {
  ConfigurationMonitor,
  monitorFoamVsCodeConfig,
} from '../services/config';

export const CONFIG_KEY = 'links.hover.enable';

const feature: FoamFeature = {
  activate: async (
    context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {
    const isHoverEnabled: ConfigurationMonitor<boolean> = monitorFoamVsCodeConfig(
      CONFIG_KEY
    );

    const foam = await foamPromise;

    context.subscriptions.push(
      isHoverEnabled,
      vscode.languages.registerHoverProvider(
        mdDocSelector,
        new HoverProvider(isHoverEnabled, foam.workspace, foam.services.parser)
      )
    );
  },
};

export class HoverProvider implements vscode.HoverProvider {
  constructor(
    private isHoverEnabled: () => boolean,
    private workspace: FoamWorkspace,
    private parser: ResourceParser
  ) {}

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Hover> {
    if (!this.isHoverEnabled()) {
      return;
    }

    const startResource = this.parser.parse(document.uri, document.getText());

    const targetLink: ResourceLink | undefined = startResource.links.find(
      link =>
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

    const content: string = await this.workspace.readAsMarkdown(targetUri);

    const md = isSome(content)
      ? getNoteTooltip(content)
      : this.workspace.get(targetUri).title;
    const hover: vscode.Hover = {
      contents: [md],
      range: toVsCodeRange(targetLink.range),
    };
    return hover;
  }
}

export default feature;
