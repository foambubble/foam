import * as vscode from 'vscode';
import { Foam } from '../core/model/foam';
import { FoamGraph } from '../core/model/graph';
import { Resource } from '../core/model/note';
import { URI } from '../core/model/uri';
import { FoamWorkspace } from '../core/model/workspace';
import { getFoamVsCodeConfig } from '../services/config';
import { fromVsCodeUri, toVsCodeUri } from '../utils/vsc-utils';
import { getNoteTooltip, getFoamDocSelectors } from '../services/editor';
import { CONVERT_WIKILINK_TO_MDLINK } from './commands/convert-links';

export const aliasCommitCharacters = ['#'];
export const linkCommitCharacters = ['#', '|'];
export const sectionCommitCharacters = ['|'];

const COMPLETION_CURSOR_MOVE = {
  command: 'foam-vscode.completion-move-cursor',
  title: 'Foam: Move cursor after completion',
};

export const WIKILINK_REGEX = /\[\[[^[\]]*(?!.*\]\])/;
export const SECTION_REGEX = /\[\[([^[\]]*#(?!.*\]\]))/;

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
      const items = resource.sections.map(b => {
        const item = new ResourceCompletionItem(
          b.label,
          vscode.CompletionItemKind.Text,
          resource.uri.with({ fragment: b.label })
        );
        item.sortText = String(b.range.start.line).padStart(5, '0');
        item.range = replacementRange;
        item.commitCharacters = sectionCommitCharacters;
        item.command = COMPLETION_CURSOR_MOVE;
        return item;
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
    const labelStyle = getCompletionLabelSetting();
    const aliasSetting = getCompletionAliasSetting();
    const linkFormat = getCompletionLinkFormatSetting();

    // Use safe range that VS Code accepts - replace content inside brackets only
    const replacementRange = new vscode.Range(
      position.line,
      position.character - (text.length - 2),
      position.line,
      position.character
    );

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
        linkFormat !== 'link' &&
        aliasSetting !== 'never' &&
        wikilinkRequiresAlias(resource, this.ws.defaultExtension);

      item.insertText = useAlias
        ? `${identifier}|${resource.title}`
        : identifier;
      // When using aliases or markdown link format, don't allow commit characters
      // since we either have the full text or will convert it
      item.commitCharacters =
        useAlias || linkFormat === 'link' ? [] : linkCommitCharacters;
      item.range = replacementRange;
      item.command =
        linkFormat === 'link'
          ? CONVERT_WIKILINK_TO_MDLINK
          : COMPLETION_CURSOR_MOVE;
      return item;
    });
    const aliases = this.ws.list().flatMap(resource =>
      resource.aliases.map(a => {
        const item = new ResourceCompletionItem(
          a.title,
          vscode.CompletionItemKind.Reference,
          resource.uri
        );

        const identifier = this.ws.getIdentifier(resource.uri);

        item.insertText = `${identifier}|${a.title}`;
        // When using markdown link format, don't allow commit characters
        item.commitCharacters =
          linkFormat === 'link' ? [] : aliasCommitCharacters;
        item.range = replacementRange;

        // If link format is enabled, convert after completion
        item.command =
          linkFormat === 'link'
            ? {
                command: CONVERT_WIKILINK_TO_MDLINK.command,
                title: CONVERT_WIKILINK_TO_MDLINK.title,
              }
            : COMPLETION_CURSOR_MOVE;

        item.detail = `Alias of ${vscode.workspace.asRelativePath(
          toVsCodeUri(resource.uri)
        )}`;
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
 * A CompletionItem related to a Resource
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

function getCompletionLinkFormatSetting() {
  const linkFormat: 'wikilink' | 'link' = getFoamVsCodeConfig(
    'completion.linkFormat'
  );
  return linkFormat;
}

const normalize = (text: string) => text.toLocaleLowerCase().trim();
function wikilinkRequiresAlias(resource: Resource, defaultExtension: string) {
  // Compare filename (without extension) to title
  const nameWithoutExt = resource.uri.getName();
  const titleWithoutExt = resource.title.endsWith(defaultExtension)
    ? resource.title.slice(0, -defaultExtension.length)
    : resource.title;
  return normalize(nameWithoutExt) !== normalize(titleWithoutExt);
}
