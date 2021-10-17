import {
  Foam,
  FoamWorkspace,
  Range,
  ResourceLink,
  ResourceParser,
  URI,
} from 'foam-core';
import * as vscode from 'vscode';
import { FoamFeature } from '../types';
import { mdDocSelector } from '../utils';
import { toVsCodeRange, toVsCodeUri } from '../utils/vsc-utils';
import { OPEN_COMMAND } from './utility-commands';
import { monitorFoamVsCodeConfig } from '../services/config';

const feature: FoamFeature = {
  activate: async (
    context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {
    const foam = await foamPromise;

    const wikilinkProvider = new WikilinkProvider(
      foam.workspace,
      foam.services.parser,
      monitorFoamVsCodeConfig('links.navigation.creationFromPlaceholder'),
      monitorFoamVsCodeConfig('links.navigation.useOpenLinkCommand'),
      monitorFoamVsCodeConfig('links.navigation.useGoToDefinitionCommand')
    );

    context.subscriptions.push(
      vscode.languages.registerDefinitionProvider(
        mdDocSelector,
        wikilinkProvider
      ),
      vscode.languages.registerDocumentLinkProvider(
        mdDocSelector,
        wikilinkProvider
      )
    );
  },
};

export class WikilinkProvider
  implements vscode.DefinitionProvider, vscode.DocumentLinkProvider {
  constructor(
    private workspace: FoamWorkspace,
    private parser: ResourceParser,
    private getCreationCmd: () => string,
    private navWithOpenLinkCmdEnabled: () => boolean,
    private navWithGoToDefinitionCmdEnabled: () => boolean
  ) {}

  public async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.LocationLink[] | vscode.Definition> {
    console.log('GO TO DEFINITION');

    const resource = this.parser.parse(document.uri, document.getText());
    const targetLink: ResourceLink | undefined = resource.links.find(link =>
      Range.containsPosition(link.range, position)
    );

    if (!targetLink) {
      return;
    }

    const creationDisabled = this.getCreationCmd() !== 'goToDefinition';

    const uri = this.workspace.resolveLink(resource, targetLink);
    if (URI.isPlaceholder(uri)) {
      if (creationDisabled) {
        return;
      }
      await OPEN_COMMAND.execute({ uri: uri });
    } else {
      if (!this.navWithGoToDefinitionCmdEnabled()) {
        return;
      }
    }

    const targetResource = this.workspace.get(uri);
    const targetRange = findFirstLineOfContent(targetResource.source.text);

    const result: vscode.LocationLink = {
      originSelectionRange: toVsCodeRange(targetLink.range),
      targetUri: toVsCodeUri(uri),
      targetRange: null, // Disable the preview feature to avoid duplication with the over feature.
      targetSelectionRange: toVsCodeRange(targetRange),
    };
    return [result];
  }

  public provideDocumentLinks(
    document: vscode.TextDocument
  ): vscode.DocumentLink[] {
    console.log('OPEN LINK');

    // return [new vscode.DocumentLink(new vscode.Range(0,23, 4, 4))];

    const creationEnabled = this.getCreationCmd() === 'openLink';

    const resource = this.parser.parse(document.uri, document.getText());

    const targets: { link: ResourceLink; target: URI }[] = resource.links.map(
      link => ({
        link: link,
        target: this.workspace.resolveLink(resource, link),
      })
    );

    return targets
      .filter(
        o =>
          (this.navWithOpenLinkCmdEnabled() && !URI.isPlaceholder(o.target)) ||
          (creationEnabled && URI.isPlaceholder(o.target))
      )
      .map(o => generateDocumentLink(o.link, o.target));
  }
}

const generateDocumentLink = (link: ResourceLink, target: URI) => {
  const command = OPEN_COMMAND.asURI(toVsCodeUri(target));
  const documentLink = new vscode.DocumentLink(
    toVsCodeRange(link.range),
    command
  );
  documentLink.tooltip = URI.isPlaceholder(target)
    ? `Create note for '${target.path}'`
    : `Go to ${URI.toFsPath(target)}`;
  return documentLink;
};

export const findFirstLineOfContent = (rawContent: string): Range => {
  let lines = rawContent.split('\n');

  let lineIndex = 0;
  let line = null;

  // Skip frontmatter.
  if (lines[0] === '---') {
    lineIndex = 1;
    let l = null;
    for (; lineIndex < lines.length && l !== '---'; lineIndex++) {
      l = lines[lineIndex];
    }
  }

  for (; lineIndex < lines.length; lineIndex++) {
    line = lines[lineIndex];
    if (line.trim()) {
      break;
    }
  }

  if (lineIndex >= lines.length) {
    return Range.create(0, 0, 0, 0);
  }

  const chars = line.split('');
  const firstChartIndex = chars.findIndex((c: string) => c.trim());
  const lastChartIndex =
    chars.length - chars.reverse().findIndex((c: string) => c.trim());

  return Range.create(lineIndex, firstChartIndex, lineIndex, lastChartIndex);
};

export default feature;
