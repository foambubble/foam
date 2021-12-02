import * as vscode from 'vscode';
import { Foam } from '../core/model/foam';
import { FoamGraph } from '../core/model/graph';
import { Resource } from '../core/model/note';
import { URI } from '../core/model/uri';
import { FoamWorkspace } from '../core/model/workspace';
import { FoamFeature } from '../types';
import { getNoteTooltip, mdDocSelector } from '../utils';
import { toVsCodeUri } from '../utils/vsc-utils';

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
        new SectionCompletionProvider(foam.workspace, foam.graph),
        '#'
      )
    );
  },
};

export class SectionCompletionProvider
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
    const match = cursorPrefix.match(/\[\[([^\[\]]*#(?!.*\]\]))/);

    if (!match) {
      return null;
    }

    const resourceId = match[1].slice(0, -1);
    const resource = this.ws.find(resourceId);
    if (resource) {
      const items = resource.blocks.map(b => {
        return new ResourceCompletionItem(
          b.label,
          vscode.CompletionItemKind.Text,
          URI.create({ ...resource.uri, fragment: b.label })
        );
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
    const requiresAutocomplete = cursorPrefix.match(/\[\[[^\[\]]*(?!.*\]\])/);

    if (!requiresAutocomplete) {
      return null;
    }

    const resources = this.ws.list().map(resource => {
      const label = vscode.workspace.asRelativePath(toVsCodeUri(resource.uri));
      const item = new ResourceCompletionItem(
        label,
        vscode.CompletionItemKind.File,
        resource.uri
      );
      item.filterText = URI.getBasename(resource.uri);
      item.insertText = this.ws.getIdentifier(resource.uri);
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
