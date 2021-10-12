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

const GO_TO_DEFINITION_NAV_MODE = 'goToDefinition';
const OPEN_LINK_NAV_MODE = 'openLink';
const MIXED_NAV_MODE = 'goToDefinitionButOpenLinkForCreation';
const NAVIGATION_DISABLED = 'off';

const feature: FoamFeature = {
  activate: async (
    context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {
    const foam = await foamPromise;

    const wikilinkProvider = new WikilinkProvider(
      foam.workspace,
      foam.services.parser,
      monitorFoamVsCodeConfig('links.navigationMode')
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
    private getNavigationMode: () => string
  ) {}

  public async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.LocationLink[] | vscode.Definition> {
    const navMode = this.getNavigationMode();
    if (navMode === OPEN_LINK_NAV_MODE || navMode === NAVIGATION_DISABLED) {
      return;
    }

    const resource = this.parser.parse(document.uri, document.getText());
    const targetLink: ResourceLink | undefined = resource.links.find(link =>
      Range.containsPosition(link.range, position)
    );

    if (!targetLink) {
      return;
    }

    const uri = this.workspace.resolveLink(resource, targetLink);
    if (URI.isPlaceholder(uri)) {
      if (navMode === MIXED_NAV_MODE) {
        return;
      }

      await OPEN_COMMAND.execute({ uri: uri });
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
    const navMode = this.getNavigationMode();
    if (
      navMode === GO_TO_DEFINITION_NAV_MODE ||
      navMode === NAVIGATION_DISABLED
    ) {
      return;
    }

    const resource = this.parser.parse(document.uri, document.getText());

    const targets: { link: ResourceLink; target: URI }[] = resource.links.map(
      link => ({
        link: link,
        target: this.workspace.resolveLink(resource, link),
      })
    );

    return targets
      .filter(
        o => navMode === OPEN_LINK_NAV_MODE || URI.isPlaceholder(o.target)
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
