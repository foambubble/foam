import * as vscode from 'vscode';
import { Foam } from '../core/model/foam';
import { FoamGraph } from '../core/model/graph';
import { URI } from '../core/model/uri';
import { FoamWorkspace } from '../core/model/workspace';
import { FoamFeature } from '../types';
import { getNoteTooltip, mdDocSelector } from '../utils';
import { fromVsCodeUri, toVsCodeUri } from '../utils/vsc-utils';

export const WIKILINK_REGEX = /\[\[[^[\]]*(?!.*\]\])/;
export const SECTION_REGEX = /\[\[([^[\]]*#(?!.*\]\]))/;
const RIGHT_BRACKETS_REGEX = /\]\]/;

const cursorMoveCommand = {
  command: 'cursorMove',
  arguments: [
    {
      to: 'right',
      by: 'character',
      value: 2,
    },
  ],
  title: 'cursorMove',
};

const feature: FoamFeature = {
  activate: async (
    context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {
    const foam = await foamPromise;
    context.subscriptions.push(
      vscode.languages.registerCompletionItemProvider(
        mdDocSelector,
        new CompletionProvider(foam.workspace, foam.graph),
        '['
      ),
      vscode.languages.registerCompletionItemProvider(
        mdDocSelector,
        new SectionCompletionProvider(foam.workspace),
        '#'
      )
    );
  },
};

export class SectionCompletionProvider
  implements vscode.CompletionItemProvider<vscode.CompletionItem> {
  constructor(private ws: FoamWorkspace) {}

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.ProviderResult<vscode.CompletionList<vscode.CompletionItem>> {
    const cursorPrefix = document
      .lineAt(position)
      .text.substr(0, position.character);
    const cursorSuffix = document
      .lineAt(position)
      .text.substr(position.character, position.character + 2);

    // Requires autocomplete only if cursorPrefix matches `[[` that NOT ended by `]]`.
    // See https://github.com/foambubble/foam/pull/596#issuecomment-825748205 for details.
    const match = cursorPrefix.match(SECTION_REGEX);

    if (!match) {
      return null;
    }

    const resourceId =
      match[1] === '#' ? fromVsCodeUri(document.uri) : match[1].slice(0, -1);
    const requireMoveCursorRight = cursorSuffix.match(RIGHT_BRACKETS_REGEX);
    const completionCommand = requireMoveCursorRight ? cursorMoveCommand : null;

    console.log('SectionCompletionProvider', { requireMoveCursorRight });

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
          resource.uri.withFragment(b.label)
        );
        item.sortText = String(b.range.start.line).padStart(5, '0');
        item.range = replacementRange;
        item.command = completionCommand;
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

export class CompletionProvider
  implements vscode.CompletionItemProvider<vscode.CompletionItem> {
  constructor(private ws: FoamWorkspace, private graph: FoamGraph) {}

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.ProviderResult<vscode.CompletionList<vscode.CompletionItem>> {
    // ANCHOR: provideCompletionItems

    const cursorPrefix = document
      .lineAt(position)
      .text.substr(0, position.character);

    const cursorSuffix = document
      .lineAt(position)
      .text.substr(position.character, position.character + 2);

    // Requires autocomplete only if cursorPrefix matches `[[` that NOT ended by `]]`.
    // See https://github.com/foambubble/foam/pull/596#issuecomment-825748205 for details.
    const requiresAutocomplete = cursorPrefix.match(WIKILINK_REGEX);
    // 如果是有 # 就代鰾是 section link，就直接用另外一個
    if (!requiresAutocomplete || requiresAutocomplete[0].indexOf('#') >= 0) {
      return null;
    }

    const text = requiresAutocomplete[0];
    const requireMoveCursorRight = cursorSuffix.match(RIGHT_BRACKETS_REGEX);
    const completionCommand = requireMoveCursorRight ? cursorMoveCommand : null;

    const replacementRange = new vscode.Range(
      position.line,
      position.character - (text.length - 2),
      position.line,
      position.character
    );
    const resources = this.ws.list().map(resource => {
      // TODO 這個是什麼的 snippet??
      // TODO 看起來 wiki limk 還有 Section  都要加上去
      const label = vscode.workspace.asRelativePath(toVsCodeUri(resource.uri));
      const item = new ResourceCompletionItem(
        label,
        vscode.CompletionItemKind.File,
        resource.uri
      );
      item.filterText = resource.uri.getName();
      item.insertText = this.ws.getIdentifier(resource.uri);
      item.range = replacementRange;
      item.command = completionCommand;
      item.commitCharacters = ['#'];
      return item;
    });
    const placeholders = Array.from(this.graph.placeholders.values()).map(
      uri => {
        // TODO 這個是什麼的 snippet??
        const item = new vscode.CompletionItem(
          uri.path,
          vscode.CompletionItemKind.Interface
        );
        console.log('path', uri.path);
        item.insertText = uri.path;
        item.command = cursorMoveCommand;
        item.range = replacementRange;
        return item;
      }
    );

    return new vscode.CompletionList([...resources, ...placeholders]);
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

export default feature;
