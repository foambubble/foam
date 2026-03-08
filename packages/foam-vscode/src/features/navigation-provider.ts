import * as vscode from 'vscode';
import { toVsCodeRange, toVsCodeUri, fromVsCodeUri } from '../utils/vsc-utils';
import { Foam } from '../core/model/foam';
import { FoamWorkspace } from '../core/model/workspace';
import { Block, Resource, ResourceLink, ResourceParser, Section } from '../core/model/note';
import { URI } from '../core/model/uri';
import { Range } from '../core/model/range';
import { FoamGraph } from '../core/model/graph';
import { Position } from '../core/model/position';
import { CREATE_NOTE_COMMAND } from './commands/create-note';
import { commandAsURI } from '../utils/commands';
import { Location } from '../core/model/location';
import { fileExists, getFoamDocSelectors } from '../services/editor';
import { FoamTags } from '../core/model/tags';

export default async function activate(
  context: vscode.ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const foam = await foamPromise;

  const navigationProvider = new NavigationProvider(
    foam.workspace,
    foam.graph,
    foam.services.parser,
    foam.tags
  );

  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(
      getFoamDocSelectors(),
      navigationProvider
    ),
    vscode.languages.registerDocumentLinkProvider(
      getFoamDocSelectors(),
      navigationProvider
    ),
    vscode.languages.registerReferenceProvider(
      getFoamDocSelectors(),
      navigationProvider
    )
  );
}

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
    vscode.ReferenceProvider
{
  constructor(
    private workspace: FoamWorkspace,
    private graph: FoamGraph,
    private parser: ResourceParser,
    private tags: FoamTags
  ) {}

  /**
   * Provide references for links, placeholders, and tags
   */
  public provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.ProviderResult<vscode.Location[]> {
    const resource = this.parser.parse(
      fromVsCodeUri(document.uri),
      document.getText()
    );

    // Check if position is on a tag first
    const targetTag = resource.tags.find(tag =>
      Range.containsPosition(tag.range, position)
    );
    if (targetTag) {
      return this.getTagReferences(targetTag.label);
    }

    // Check if position is on a link
    const targetLink: ResourceLink | undefined = resource.links.find(link =>
      Range.containsPosition(link.range, position)
    );
    if (targetLink) {
      const uri = this.workspace.resolveLink(resource, targetLink);
      return this.graph
        .getBacklinks(uri)
        .map(
          connection =>
            new vscode.Location(
              toVsCodeUri(connection.source),
              toVsCodeRange(connection.link.range)
            )
        );
    }

    return;
  }

  /**
   * Get all references for a given tag label across the workspace
   */
  private getTagReferences(tagLabel: string): vscode.Location[] {
    const references: vscode.Location[] = [];
    const tagLocations = this.tags.tags.get(tagLabel) ?? [];
    for (const tagLocation of tagLocations) {
      references.push(
        new vscode.Location(
          toVsCodeUri(tagLocation.uri),
          toVsCodeRange(tagLocation.range)
        )
      );
    }
    return references;
  }

  /**
   * Create definitions for resolved links
   */
  public async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.LocationLink[]> {
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
      // For direct path links, check if the file actually exists on disk even
      // though it's not indexed in the workspace (e.g. extensionless files like
      // .editorconfig that no provider recognises). If so, open it directly.
      // See: https://github.com/foambubble/foam/issues/1379
      if (targetLink.type === 'link') {
        const realUri = uri.with({ scheme: 'file' });
        if (await fileExists(realUri)) {
          return [
            {
              originSelectionRange: new vscode.Range(
                targetLink.range.start.line,
                targetLink.range.start.character,
                targetLink.range.end.line,
                targetLink.range.end.character
              ),
              targetUri: toVsCodeUri(realUri),
              targetRange: new vscode.Range(0, 0, 0, 0),
              targetSelectionRange: new vscode.Range(0, 0, 0, 0),
            },
          ];
        }
      }
      return;
    }

    const targetResource = this.workspace.get(uri);
    const fragmentRange = resolveFragmentRange(targetResource, uri.fragment);

    const targetRange = fragmentRange
      ?? Range.createFromPosition(Position.create(0, 0), Position.create(0, 0));
    const targetSelectionRange = fragmentRange
      ?? Range.createFromPosition(targetRange.start);

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
  public async provideDocumentLinks(
    document: vscode.TextDocument
  ): Promise<vscode.DocumentLink[]> {
    const documentUri = fromVsCodeUri(document.uri);
    const resource = this.parser.parse(documentUri, document.getText());

    const targets: { link: ResourceLink; target: URI }[] = resource.links.map(
      link => ({
        link,
        target: this.workspace.resolveLink(resource, link),
      })
    );

    const placeholders = targets.filter(o => o.target.isPlaceholder()); // links to resources are managed by the definition provider

    const links: vscode.DocumentLink[] = (
      await Promise.all(
        placeholders.map(async o => {
          // For direct path links, skip if the file actually exists on disk but
          // isn't indexed (e.g. extensionless dotfiles). VS Code handles them natively.
          // See: https://github.com/foambubble/foam/issues/1379
          if (o.link.type === 'link') {
            const realUri = o.target.with({ scheme: 'file' });
            if (await fileExists(realUri)) {
              return null;
            }
          }

          const command = CREATE_NOTE_COMMAND.forPlaceholder(
            Location.forObjectWithRange(documentUri, o.link),
            this.workspace.defaultExtension,
            {
              onFileExists: 'open',
            }
          );

          const documentLink = new vscode.DocumentLink(
            new vscode.Range(
              o.link.range.start.line,
              o.link.range.start.character + 2,
              o.link.range.end.line,
              o.link.range.end.character - 2
            ),
            commandAsURI(command)
          );
          documentLink.tooltip = `Create note for '${o.target.path}'`;
          return documentLink;
        })
      )
    ).filter(Boolean);

    const tags: vscode.DocumentLink[] = resource.tags.map(tag => {
      const command = {
        name: 'foam-vscode.views.tags-explorer.focus',
        params: [tag.label, documentUri],
      };

      const documentLink = new vscode.DocumentLink(
        new vscode.Range(
          tag.range.start.line,
          tag.range.start.character,
          tag.range.end.line,
          tag.range.end.character
        ),
        commandAsURI(command)
      );
      documentLink.tooltip = `Explore tag '${tag.label}'`;
      return documentLink;
    });

    return links.concat(tags);
  }
}

/**
 * Returns the Range for a URI fragment, handling both section links
 * (`#Heading`) and block anchor links (`#^blockid`).
 * Returns null if the fragment is empty or not found.
 */
function resolveFragmentRange(
  resource: Resource,
  fragment: string
): (Section | Block)['range'] | null {
  if (!fragment) {
    return null;
  }
  if (fragment.startsWith('^')) {
    return Resource.findBlock(resource, fragment.slice(1))?.range ?? null;
  }
  return Resource.findSection(resource, fragment)?.range ?? null;
}
