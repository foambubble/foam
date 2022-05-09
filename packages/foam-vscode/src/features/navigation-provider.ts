import * as vscode from 'vscode';
import { FoamFeature } from '../types';
import { mdDocSelector } from '../utils';
import { toVsCodeRange, toVsCodeUri, fromVsCodeUri } from '../utils/vsc-utils';
import { OPEN_COMMAND } from './utility-commands';
import { Foam } from '../core/model/foam';
import { FoamWorkspace } from '../core/model/workspace';
import { Resource, ResourceLink, ResourceParser } from '../core/model/note';
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
 * - We create definintions for existing wikilinks but not placeholders
 * - We create links for both
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
    const resource = this.parser.parse(
      fromVsCodeUri(document.uri),
      document.getText()
    );
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
  public provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.LocationLink[] {
    const resource = this.parser.parse(
      fromVsCodeUri(document.uri),
      document.getText()
    );
    const targetLink: ResourceLink | undefined = resource.links.find(link =>
      Range.containsPosition(link.range, position)
    );
    if (!targetLink) {
      return;
    }

    const uri = this.workspace.resolveLink(resource, targetLink);
    if (uri.isPlaceholder()) {
      return;
    }

    const targetResource = this.workspace.get(uri);
    const section = Resource.findSection(targetResource, uri.fragment);

    const targetRange = section
      ? section.range
      : Range.createFromPosition(
          targetResource.source.contentStart,
          targetResource.source.end
        );
    const targetSelectionRange = section
      ? section.range
      : Range.createFromPosition(targetRange.start);

    const result: vscode.LocationLink = {
      originSelectionRange: new vscode.Range(
        targetLink.range.start.line,
        targetLink.range.start.character +
          (targetLink.type === 'wikilink' ? 2 : 0),
        targetLink.range.end.line,
        targetLink.range.end.character -
          (targetLink.type === 'wikilink' ? 2 : 0)
      ),
      targetUri: toVsCodeUri(uri.asPlain()),
      targetRange: toVsCodeRange(targetRange),
      targetSelectionRange: toVsCodeRange(targetSelectionRange),
    };
    return [result];
  }

  /**
   * Create links for wikilinks and placeholders
   */
  public provideDocumentLinks(
    document: vscode.TextDocument
  ): vscode.DocumentLink[] {
    const resource = this.parser.parse(
      fromVsCodeUri(document.uri),
      document.getText()
    );

    const targets: { link: ResourceLink; target: URI }[] = resource.links.map(
      link => ({
        link,
        target: this.workspace.resolveLink(resource, link),
      })
    );

    return targets.map(o => {
      const command = OPEN_COMMAND.asURI(o.target);
      const documentLink = new vscode.DocumentLink(
        new vscode.Range(
          o.link.range.start.line,
          o.link.range.start.character + 2,
          o.link.range.end.line,
          o.link.range.end.character - 2
        ),
        command
      );
      documentLink.tooltip = o.target.isPlaceholder()
        ? `Create note for '${o.target.path}'`
        : `Go to ${o.target.toFsPath()}`;
      return documentLink;
    });
  }
}

export default feature;
