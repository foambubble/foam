import * as vscode from 'vscode';
import { Foam } from '../core/model/foam';
import { FoamGraph } from '../core/model/graph';
import { Resource } from '../core/model/note';
import { URI } from '../core/model/uri';
import { FoamWorkspace } from '../core/model/workspace';
import { getFoamVsCodeConfig } from '../services/config';
import { fromVsCodeUri, toVsCodeUri } from '../utils/vsc-utils';
import { getNoteTooltip, getFoamDocSelectors } from '../services/editor';

export const aliasCommitCharacters = ['#'];
export const linkCommitCharacters = ['#', '|'];
export const sectionCommitCharacters = ['|'];

const COMPLETION_CURSOR_MOVE = {
  command: 'foam-vscode.completion-move-cursor',
  title: 'Foam: Move cursor after completion',
};

export const WIKILINK_REGEX = /\[\[[^[\]]*(?!.*\]\])/;
export const SECTION_REGEX = /\[\[([^[\]]*#(?!.*\]\]))/;

/**
 * Activates the completion features for Foam.
 * This includes registering completion providers for wikilinks and sections,
 * and a command to handle cursor movement after completion.
 */
export default async function activate(
  context: vscode.ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const foam = await foamPromise;
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      getFoamDocSelectors(),
      new WikilinkCompletionProvider(foam.workspace, foam.graph),
      '['
    ),
    vscode.languages.registerCompletionItemProvider(
      getFoamDocSelectors(),
      new SectionCompletionProvider(foam.workspace),
      '#'
    ),

    /**
     * always jump to the closing bracket, but jump back the cursor when commit
     * by alias divider `|` and section divider `#`
     * See https://github.com/foambubble/foam/issues/962,
     */
    vscode.commands.registerCommand(
      COMPLETION_CURSOR_MOVE.command,
      async () => {
        const activeEditor = vscode.window.activeTextEditor;
        const document = activeEditor.document;
        const currentPosition = activeEditor.selection.active;
        const cursorChange = vscode.window.onDidChangeTextEditorSelection(
          async e => {
            const changedPosition = e.selections[0].active;
            const preChar = document
              .lineAt(changedPosition.line)
              .text.charAt(changedPosition.character - 1);

            const { character: selectionChar, line: selectionLine } =
              e.selections[0].active;

            const { line: completionLine, character: completionChar } =
              currentPosition;

            const inCompleteBySectionDivider =
              linkCommitCharacters.includes(preChar) &&
              selectionLine === completionLine &&
              selectionChar === completionChar + 1;

            cursorChange.dispose();
            if (inCompleteBySectionDivider) {
              await vscode.commands.executeCommand('cursorMove', {
                to: 'left',
                by: 'character',
                value: 2,
              });
            }
          }
        );

        await vscode.commands.executeCommand('cursorMove', {
          to: 'right',
          by: 'character',
          value: 2,
        });
      }
    )
  );
}

/**
 * Provides completion items for sections (headings and block IDs) within a note.
 * Triggered when the user types `#` inside a wikilink.
 */
export class SectionCompletionProvider
  implements vscode.CompletionItemProvider<vscode.CompletionItem>
{
  constructor(private ws: FoamWorkspace) {}

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.ProviderResult<vscode.CompletionList<vscode.CompletionItem>> {
    const cursorPrefix = document
      .lineAt(position)
      .text.substr(0, position.character);

    // Requires autocomplete only if cursorPrefix matches `[[` that NOT ended by `]]`.
    // See https://github.com/foambubble/foam/pull/596#issuecomment-825748205 for details.
    const match = cursorPrefix.match(SECTION_REGEX);

    if (!match) {
      return null;
    }

    // Determine the target resource. If the link is just `[[#...]]`,
    // it refers to the current document. Otherwise, it's the text before the '#'.
    const resourceId =
      match[1] === '#' ? fromVsCodeUri(document.uri) : match[1].slice(0, -1);

    const resource = this.ws.find(resourceId);
    const replacementRange = new vscode.Range(
      position.line,
      cursorPrefix.lastIndexOf('#') + 1,
      position.line,
      position.character
    );
    if (resource) {
      const items = resource.sections.flatMap(section => {
        const sectionItems: vscode.CompletionItem[] = [];
        switch (section.type) {
          case 'heading':
            // For headings, we provide a completion item for the slugified heading ID.
            if (section.id) {
              const slugItem = new ResourceCompletionItem(
                section.label,
                vscode.CompletionItemKind.Text,
                resource.uri.with({ fragment: section.id })
              );
              slugItem.sortText = String(section.range.start.line).padStart(
                5,
                '0'
              );
              slugItem.range = replacementRange;
              slugItem.commitCharacters = sectionCommitCharacters;
              slugItem.command = COMPLETION_CURSOR_MOVE;
              slugItem.insertText = section.id;
              sectionItems.push(slugItem);
            }
            // If a heading also has a block ID, we provide a separate completion for it.
            // The label includes the `^` for clarity, but the inserted text does not.
            if (section.blockId) {
              const blockIdItem = new ResourceCompletionItem(
                section.blockId,
                vscode.CompletionItemKind.Text,
                resource.uri.with({ fragment: section.blockId.substring(1) })
              );
              blockIdItem.sortText = String(section.range.start.line).padStart(
                5,
                '0'
              );
              blockIdItem.range = replacementRange;
              blockIdItem.commitCharacters = sectionCommitCharacters;
              blockIdItem.command = COMPLETION_CURSOR_MOVE;
              blockIdItem.insertText = section.blockId.substring(1);
              sectionItems.push(blockIdItem);
            }
            break;
          case 'block': {
            // For non-heading elements (paragraphs, list items, etc.), we only offer
            // completion if they have an explicit block ID.
            const blockIdItem = new ResourceCompletionItem(
              section.blockId, // e.g. ^my-block-id
              vscode.CompletionItemKind.Text,
              resource.uri.with({ fragment: section.blockId.substring(1) }) // fragment is 'my-block-id'
            );
            blockIdItem.sortText = String(section.range.start.line).padStart(
              5,
              '0'
            );
            blockIdItem.range = replacementRange;
            blockIdItem.commitCharacters = sectionCommitCharacters;
            blockIdItem.command = COMPLETION_CURSOR_MOVE;
            // Insert the block ID without the leading `^`.
            blockIdItem.insertText = section.blockId.substring(1);
            sectionItems.push(blockIdItem);
            break;
          }
        }
        return sectionItems;
      });
      return new vscode.CompletionList(items);
    }
  }

  resolveCompletionItem(
    item: ResourceCompletionItem | vscode.CompletionItem
  ): vscode.ProviderResult<vscode.CompletionItem> {
    if (item instanceof ResourceCompletionItem) {
      return this.ws.readAsMarkdown(item.resourceUri).then(text => {
        item.documentation = getNoteTooltip(text);
        return item;
      });
    }
    return item;
  }
}

/**
 * Provides completion items for wikilinks.
 * Triggered when the user types `[[`.
 */
export class WikilinkCompletionProvider
  implements vscode.CompletionItemProvider<vscode.CompletionItem>
{
  constructor(private ws: FoamWorkspace, private graph: FoamGraph) {}

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.ProviderResult<vscode.CompletionList<vscode.CompletionItem>> {
    const cursorPrefix = document
      .lineAt(position)
      .text.substr(0, position.character);

    // Requires autocomplete only if cursorPrefix matches `[[` that NOT ended by `]]`.
    // See https://github.com/foambubble/foam/pull/596#issuecomment-825748205 for details.
    const requiresAutocomplete = cursorPrefix.match(WIKILINK_REGEX);
    if (!requiresAutocomplete || requiresAutocomplete[0].indexOf('#') >= 0) {
      return null;
    }

    const text = requiresAutocomplete[0];

    const replacementRange = new vscode.Range(
      position.line,
      position.character - (text.length - 2),
      position.line,
      position.character
    );
    const labelStyle = getCompletionLabelSetting();
    const aliasSetting = getCompletionAliasSetting();

    const resources = this.ws.list().map(resource => {
      const resourceIsDocument =
        ['attachment', 'image'].indexOf(resource.type) === -1;

      const identifier = this.ws.getIdentifier(resource.uri);

      const label = !resourceIsDocument
        ? identifier
        : labelStyle === 'path'
        ? vscode.workspace.asRelativePath(toVsCodeUri(resource.uri))
        : labelStyle === 'title'
        ? resource.title
        : identifier;

      const item = new ResourceCompletionItem(
        label,
        vscode.CompletionItemKind.File,
        resource.uri
      );

      item.detail = vscode.workspace.asRelativePath(toVsCodeUri(resource.uri));
      item.sortText = resourceIsDocument
        ? `0-${item.label}`
        : `1-${item.label}`;

      const useAlias =
        resourceIsDocument &&
        aliasSetting !== 'never' &&
        wikilinkRequiresAlias(resource);

      item.insertText = useAlias
        ? `${identifier}|${resource.title}`
        : identifier;
      item.commitCharacters = useAlias ? [] : linkCommitCharacters;
      item.range = replacementRange;
      item.command = COMPLETION_CURSOR_MOVE;
      return item;
    });
    const aliases = this.ws.list().flatMap(resource =>
      resource.aliases.map(a => {
        const item = new ResourceCompletionItem(
          a.title,
          vscode.CompletionItemKind.Reference,
          resource.uri
        );
        item.insertText = this.ws.getIdentifier(resource.uri) + '|' + a.title;
        item.detail = `Alias of ${vscode.workspace.asRelativePath(
          toVsCodeUri(resource.uri)
        )}`;
        item.range = replacementRange;
        item.command = COMPLETION_CURSOR_MOVE;
        item.commitCharacters = aliasCommitCharacters;
        return item;
      })
    );
    const placeholders = Array.from(this.graph.placeholders.values()).map(
      uri => {
        const item = new vscode.CompletionItem(
          uri.path,
          vscode.CompletionItemKind.Interface
        );
        item.insertText = uri.path;
        item.command = COMPLETION_CURSOR_MOVE;
        item.range = replacementRange;
        return item;
      }
    );

    return new vscode.CompletionList([
      ...resources,
      ...aliases,
      ...placeholders,
    ]);
  }

  resolveCompletionItem(
    item: ResourceCompletionItem | vscode.CompletionItem
  ): vscode.ProviderResult<vscode.CompletionItem> {
    if (item instanceof ResourceCompletionItem) {
      return this.ws.readAsMarkdown(item.resourceUri).then(text => {
        item.documentation = getNoteTooltip(text);
        return item;
      });
    }
    return item;
  }
}

/**
 * A custom CompletionItem that includes the URI of the resource it refers to.
 * This is used to resolve additional information, like tooltips, on demand.
 */
class ResourceCompletionItem extends vscode.CompletionItem {
  constructor(
    label: string,
    type: vscode.CompletionItemKind,
    public resourceUri: URI
  ) {
    super(label, type);
  }
}

function getCompletionLabelSetting() {
  const labelStyle: 'path' | 'title' | 'identifier' =
    getFoamVsCodeConfig('completion.label');
  return labelStyle;
}

function getCompletionAliasSetting() {
  const aliasStyle: 'never' | 'whenPathDiffersFromTitle' = getFoamVsCodeConfig(
    'completion.useAlias'
  );
  return aliasStyle;
}

const normalize = (text: string) => text.toLocaleLowerCase().trim();
function wikilinkRequiresAlias(resource: Resource) {
  return normalize(resource.uri.getName()) !== normalize(resource.title);
}
