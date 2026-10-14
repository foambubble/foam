import * as vscode from 'vscode';
import { toVsCodeRange, toVsCodeUri, fromVsCodeUri } from '../../utils/vsc-utils';
import { Foam } from '@foam/core';
import { FoamWorkspace } from '@foam/core';
import {
  Block,
  Footnote,
  Resource,
  ResourceLink,
  ResourceParser,
  Section,
} from '@foam/core';
import { URI } from '@foam/core';
import { Range } from '@foam/core';
import { FoamGraph } from '@foam/core';
import { Position } from '@foam/core';
import { CREATE_NOTE_COMMAND } from '../notes/create-note';
import { commandAsURI } from '../../utils/commands';
import { Location } from '@foam/core';
import { fileExists, getFoamDocSelectors } from '../../services/editor';
import { FoamTags } from '@foam/core';
import { monitorFoamVsCodeConfig } from '../../config';

export const CONFIG_FOOTNOTES_ENABLE = 'footnotes.enable';

export default async function activate(
  context: vscode.ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const isFootnotesEnabled = monitorFoamVsCodeConfig<boolean>(
    CONFIG_FOOTNOTES_ENABLE
  );
  const foam = await foamPromise;

  const navigationProvider = new NavigationProvider(
    foam.workspace,
    foam.graph,
    foam.services.parser,
    foam.tags,
    isFootnotesEnabled
  );

  context.subscriptions.push(
    isFootnotesEnabled,
    vscode.languages.registerDefinitionProvider(
      getFoamDocSelectors(),
      navigationProvider
    ),
    vscode.languages.registerDocumentLinkProvider(
      getFoamDocSelectors(),
      navigationProvider
    ),
    vscode.languages.registerHoverProvider(
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
 * - We create links for wikilinks, reference-style links and placeholders
 * - We create definitions for wikilinks and for direct markdown links that
 *   resolve to something VS Code would not navigate to itself
 * - We create references for all of them
 *
 * A wikilink to an existing note gets both. The definition is what Go to
 * Definition (`F12`) and Peek Definition work from; the DocumentLink invokes
 * `vscode.open`, which honors `workbench.editorAssociations` so the target can
 * open in the editor the user chose (see
 * https://github.com/foambubble/foam/issues/1742). Which of the two the
 * workbench follows on ctrl/cmd+click is its own decision and not observable
 * from an extension — if it follows the definition the click lands in a text
 * editor, which is what it has always done.
 *
 * Placeholders are links so that clicking one creates a note. Definitions are
 * automatically invoked by VS Code on hover, whereas links require an explicit
 * click — and we want the note creation to be explicit.
 *
 * Also see https://github.com/foambubble/foam/pull/724
 */
export class NavigationProvider
  implements
    vscode.DefinitionProvider,
    vscode.DocumentLinkProvider,
    vscode.HoverProvider,
    vscode.ReferenceProvider
{
  constructor(
    private workspace: FoamWorkspace,
    private graph: FoamGraph,
    private parser: ResourceParser,
    private tags: FoamTags,
    private isFootnotesEnabled: () => boolean = () => true
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
      if (!this.isFootnotesEnabled()) {
        return;
      }
      const footnote = Footnote.findByPosition(resource, position);
      if (footnote?.definitionRange) {
        return [
          {
            originSelectionRange: toVsCodeRange(
              footnote.references.find(r =>
                Range.containsPosition(r, position)
              )!
            ),
            targetUri: document.uri,
            targetRange: toVsCodeRange(footnote.definitionRange),
            targetSelectionRange: toVsCodeRange(footnote.definitionRange),
          },
        ];
      }
      return;
    }

    // Resolved reference-style links (wikilinks and markdown links with [ref]: definitions)
    // are handled by provideDocumentLinks, which emits a DocumentLink pointing directly at
    // the target file. Returning here avoids a duplicate "2 definitions" picker.
    if (ResourceLink.isResolvedReference(targetLink)) {
      return;
    }
    const uri = this.workspace.resolveLink(resource, targetLink);
    if (targetLink.type === 'external') {
      return;
    }
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

    // Attachments (PDFs, docs, etc.) and images are surfaced as DocumentLinks.
    // See: https://github.com/foambubble/foam/issues/1675
    if (
      targetResource?.type === 'attachment' ||
      targetResource?.type === 'image'
    ) {
      return;
    }

    const fragmentRange = resolveFragmentRange(targetResource, uri.fragment);

    const targetRange =
      fragmentRange ??
      Range.createFromPosition(Position.create(0, 0), Position.create(0, 0));
    const targetSelectionRange =
      fragmentRange ?? Range.createFromPosition(targetRange.start);

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

    const placeholders = targets.filter(o => o.target.isPlaceholder()); // handled below, as "create note" links

    // The clickable range mirrors the built-in Markdown extension's styling:
    // for wikilinks the content without the surrounding brackets, for full
    // reference links ([text][ref]) the reference label, and for collapsed
    // ([text][]) and shortcut ([text]) reference links the text itself.
    const linkRange = (link: ResourceLink) => {
      if (link.type === 'wikilink') {
        return new vscode.Range(
          link.range.start.line,
          link.range.start.character + 2,
          link.range.end.line,
          link.range.end.character - 2
        );
      }
      if (ResourceLink.isReferenceStyleLink(link)) {
        const fullForm = /^\[.*\]\[(.+)\]$/.exec(link.rawText);
        if (fullForm) {
          // the reference label sits right before the closing bracket
          return new vscode.Range(
            link.range.end.line,
            link.range.end.character - 1 - fullForm[1].length,
            link.range.end.line,
            link.range.end.character - 1
          );
        }
        const textForm = /^\[(.*?)\](\[\])?$/.exec(link.rawText);
        if (textForm) {
          return new vscode.Range(
            link.range.start.line,
            link.range.start.character + 1,
            link.range.start.line,
            link.range.start.character + 1 + textForm[1].length
          );
        }
      }
      return toVsCodeRange(link.range);
    };

    // Wikilinks, and reference-style links (wikilinks and markdown links with
    // [ref]: definitions), are surfaced as DocumentLinks that invoke the
    // `vscode.open` command — the same mechanism the built-in Markdown
    // extension uses, which resolves `workbench.editorAssociations` at every
    // settings scope. Wikilinks also have a definition, which is what keeps
    // `F12` and Peek Definition working on them; see the class comment.
    // Reference-style links need the explicit link for a second reason: VS
    // Code's built-in Markdown provider otherwise intercepts cmd+click and
    // navigates to the definition line ([ref]: url) rather than to the target
    // file.
    // Direct markdown links ([text](file.md)) are left to the built-in Markdown
    // extension.
    // See: https://github.com/foambubble/foam/issues/1675
    //  and https://github.com/foambubble/foam/issues/1742
    const openLinks: vscode.DocumentLink[] = targets
      .filter(o => {
        if (o.target.isPlaceholder()) return false;
        if (o.link.type === 'external') return false;
        return (
          o.link.type === 'wikilink' || ResourceLink.isResolvedReference(o.link)
        );
      })
      .map(o => {
        const selection = this.fragmentSelection(o.target);
        const dl = new vscode.DocumentLink(
          linkRange(o.link),
          commandAsURI({
            name: 'vscode.open',
            params: selection
              ? [toVsCodeUri(o.target.asPlain()), { selection }]
              : [toVsCodeUri(o.target.asPlain())],
          })
        );
        dl.tooltip = o.target.getBasename();
        return dl;
      });

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

    return links.concat(openLinks).concat(tags);
  }

  /**
   * The range a link's `#fragment` points at, for `vscode.open` to select, so
   * that `[[note#Section]]` and `[[note#^block]]` land on the section or block
   * when navigation goes through the command rather than through a definition.
   * Returns `undefined` when there is no fragment or it resolves to nothing, in
   * which case the target opens at the top.
   */
  private fragmentSelection(target: URI): Range | undefined {
    if (!target.fragment) {
      return undefined;
    }
    const resource = this.workspace.find(target);
    return (
      (resource && resolveFragmentRange(resource, target.fragment)) ?? undefined
    );
  }

  /**
   * Show footnote content on hover over a footnote reference
   */
  public provideHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.ProviderResult<vscode.Hover> {
    if (!this.isFootnotesEnabled()) {
      return;
    }
    const resource = this.parser.parse(
      fromVsCodeUri(document.uri),
      document.getText()
    );
    const footnote = Footnote.findByPosition(resource, position);
    if (!footnote?.definitionRange) {
      return;
    }
    const defLine = document.lineAt(footnote.definitionRange.start.line).text;
    const content = defLine.replace(/\[/g, '\\[');
    return new vscode.Hover(
      new vscode.MarkdownString(content),
      toVsCodeRange(
        footnote.references.find(r => Range.containsPosition(r, position))!
      )
    );
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
