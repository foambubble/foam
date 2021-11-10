import * as vscode from 'vscode';
import { FoamFeature } from '../types';
import { mdDocSelector } from '../utils';
import { toVsCodeRange, toVsCodeUri } from '../utils/vsc-utils';
import { OPEN_COMMAND } from './utility-commands';
import { Foam } from '../core/model/foam';
import { FoamWorkspace } from '../core/model/workspace';
import { ResourceLink, ResourceParser } from '../core/model/note';
import { URI } from '../core/model/uri';
import { Range } from '../core/model/range';
import { FoamGraph } from '../core/model/graph';

const feature: FoamFeature = {
  activate: async (
    context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {
    const foam = await foamPromise;

    const navigationProvider = new NavigationProvider(
      foam.workspace,
      foam.graph,
      foam.services.parser
    );

    context.subscriptions.push(
      vscode.languages.registerDefinitionProvider(
        mdDocSelector,
        navigationProvider
      ),
      vscode.languages.registerDocumentLinkProvider(
        mdDocSelector,
        navigationProvider
      ),
      vscode.languages.registerReferenceProvider(
        mdDocSelector,
        navigationProvider
      )
    );
  },
};

/**
 * Provides navigation and references for Foam links.
 * - We create definintions for existing wikilinks
 * - We create links for placholders
 * - We create references for both
 *
 * Placeholders are created as links so that when clicking on them a new note will be created.
 * Definitions are automatically invoked by VS Code on hover, whereas links require
 * the user to explicitly clicking - and we want the note creation to be explicit.
 *
 * Also see https://github.com/foambubble/foam/pull/724
 */
export class NavigationProvider
  implements
    vscode.DefinitionProvider,
    vscode.DocumentLinkProvider,
    vscode.ReferenceProvider {
  constructor(
    private workspace: FoamWorkspace,
    private graph: FoamGraph,
    private parser: ResourceParser
  ) {}

  /**
   * Provide references for links and placholders
   */
  public provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.ProviderResult<vscode.Location[]> {
    const resource = this.parser.parse(document.uri, document.getText());
    const targetLink: ResourceLink | undefined = resource.links.find(link =>
      Range.containsPosition(link.range, position)
    );
    if (!targetLink) {
      return;
    }

    const uri = this.workspace.resolveLink(resource, targetLink);

    return this.graph.getBacklinks(uri).map(connection => {
      return new vscode.Location(
        toVsCodeUri(connection.source),
        toVsCodeRange(connection.link.range)
      );
    });
  }

  /**
   * Create definitions for resolved links
   */
  public async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.LocationLink[]> {
    const resource = this.parser.parse(document.uri, document.getText());
    const targetLink: ResourceLink | undefined = resource.links.find(link =>
      Range.containsPosition(link.range, position)
    );
    if (!targetLink) {
      return;
    }

    const uri = this.workspace.resolveLink(resource, targetLink);
    if (URI.isPlaceholder(uri)) {
      return;
    }

    const targetResource = this.workspace.get(uri);

    const result: vscode.LocationLink = {
      originSelectionRange: toVsCodeRange(targetLink.range),
      targetUri: toVsCodeUri(uri),
      targetRange: toVsCodeRange(
        Range.createFromPosition(
          targetResource.source.contentStart,
          targetResource.source.end
        )
      ),
      targetSelectionRange: toVsCodeRange(
        Range.createFromPosition(
          targetResource.source.contentStart,
          targetResource.source.contentStart
        )
      ),
    };
    return [result];
  }

  /**
   * Create links for placholders
   */
  public provideDocumentLinks(
    document: vscode.TextDocument
  ): vscode.DocumentLink[] {
    const resource = this.parser.parse(document.uri, document.getText());

    const targets: { link: ResourceLink; target: URI }[] = resource.links
      .map(link => ({
        link,
        target: this.workspace.resolveLink(resource, link),
      }))
      .filter(link => URI.isPlaceholder(link.target));

    return targets.map(o => {
      const command = OPEN_COMMAND.asURI(toVsCodeUri(o.target));
      const documentLink = new vscode.DocumentLink(
        toVsCodeRange(o.link.range),
        command
      );
      documentLink.tooltip = `Create note for '${o.target.path}'`;
      return documentLink;
    });
  }
}

export default feature;
