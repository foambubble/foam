import * as vscode from 'vscode';
import { URI } from '../core/model/uri';
import { FoamFeature } from '../types';
import { getNoteTooltip, mdDocSelector, isSome } from '../utils';
import { fromVsCodeUri, toVsCodeRange } from '../utils/vsc-utils';
import {
  ConfigurationMonitor,
  monitorFoamVsCodeConfig,
} from '../services/config';
import { ResourceLink, ResourceParser } from '../core/model/note';
import { Foam } from '../core/model/foam';
import { FoamWorkspace } from '../core/model/workspace';
import { Range } from '../core/model/range';
import { FoamGraph } from '../core/model/graph';
import { OPEN_COMMAND } from './utility-commands';

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
        new HoverProvider(
          isHoverEnabled,
          foam.workspace,
          foam.graph,
          foam.services.parser
        )
      )
    );
  },
};

export class HoverProvider implements vscode.HoverProvider {
  constructor(
    private isHoverEnabled: () => boolean,
    private workspace: FoamWorkspace,
    private graph: FoamGraph,
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

    const startResource = this.parser.parse(
      fromVsCodeUri(document.uri),
      document.getText()
    );

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
    const refs = this.graph
      .getBacklinks(targetUri)
      .filter(link => !URI.isEqual(link.source, fromVsCodeUri(document.uri)));

    const links = refs.slice(0, 10).map(link => {
      const command = OPEN_COMMAND.asURI(link.source);
      return `- [${
        this.workspace.get(link.source).title
      }](${command.toString()})`;
    });

    const notes = `note${refs.length > 1 ? 's' : ''}`;
    const references = getNoteTooltip(
      [
        `Also referenced in ${refs.length} ${notes}:`,
        ...links,
        links.length === refs.length ? '' : '- ...',
      ].join('\n')
    );

    let mdContent = null;
    if (!URI.isPlaceholder(targetUri)) {
      const content: string = await this.workspace.readAsMarkdown(targetUri);

      mdContent = isSome(content)
        ? getNoteTooltip(content)
        : this.workspace.get(targetUri).title;
    }

    const hover: vscode.Hover = {
      contents: [mdContent, refs.length > 0 ? references : null],
      range: toVsCodeRange(targetLink.range),
    };
    return hover;
  }
}

export default feature;
