import * as vscode from 'vscode';
import { Foam } from '../core/model/foam';
import { FoamGraph } from '../core/model/graph';
import { URI } from '../core/model/uri';
import { FoamWorkspace } from '../core/model/workspace';
import { FoamFeature } from '../types';
import { getNoteTooltip, mdDocSelector } from '../utils';
import { fromVsCodeUri, toVsCodeUri } from '../utils/vsc-utils';

export const WIKILINK_REGEX = /\[\[[^\[\]]*(?!.*\]\])/;
export const SECTION_REGEX = /\[\[([^\[\]]*#(?!.*\]\]))/;

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

    // Requires autocomplete only if cursorPrefix matches `[[` that NOT ended by `]]`.
    // See https://github.com/foambubble/foam/pull/596#issuecomment-825748205 for details.
    // eslint-disable-next-line no-useless-escape
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
          URI.withFragment(resource.uri, b.label)
        );
        item.sortText = String(b.range.start.line).padStart(5, '0');
        item.range = replacementRange;
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
    const cursorPrefix = document
      .lineAt(position)
      .text.substr(0, position.character);

    // Requires autocomplete only if cursorPrefix matches `[[` that NOT ended by `]]`.
    // See https://github.com/foambubble/foam/pull/596#issuecomment-825748205 for details.
    // eslint-disable-next-line no-useless-escape
    const requiresAutocomplete = cursorPrefix.match(WIKILINK_REGEX);

    if (!requiresAutocomplete || cursorPrefix.indexOf('#') >= 0) {
      return null;
    }

    const text = requiresAutocomplete[0];
    const replacementRange = new vscode.Range(
      position.line,
      position.character - (text.length - 2),
      position.line,
      position.character
    );
    const resources = this.ws.list().map(resource => {
      const label = vscode.workspace.asRelativePath(toVsCodeUri(resource.uri));
      const item = new ResourceCompletionItem(
        label,
        vscode.CompletionItemKind.File,
        resource.uri
      );
      item.filterText = URI.getBasename(resource.uri);
      item.insertText = this.ws.getIdentifier(resource.uri);
      item.range = replacementRange;
      item.commitCharacters = ['#'];
      return item;
    });
    const placeholders = Array.from(this.graph.placeholders.values()).map(
      uri => {
        const item = new vscode.CompletionItem(
          uri.path,
          vscode.CompletionItemKind.Interface
        );
        item.insertText = uri.path;
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
