import * as vscode from 'vscode';
import {
  FoamGraph,
  FoamWorkspace,
  LoadedQuery,
  Logger,
  URI,
  executeQuery,
  uriToWorkspacePath,
} from '@foam/core';
import { BaseTreeProvider } from '../../utils/tree-views/base-tree-provider';
import {
  ResourceTreeItem,
  UriTreeItem,
} from '../../utils/tree-views/tree-view-utils';
import {
  Folder,
  FolderTreeItem,
} from '../../utils/tree-views/folder-tree-provider';
import { ContextMemento } from '../../utils/vsc-utils';
import { toVsCodeUri } from '../../utils/vsc-utils';
import { SmartFolderStorage } from './smart-folder-storage';

type Element =
  | SmartFolderTreeItem
  | SmartFolderErrorTreeItem
  | FolderTreeItem<URI>
  | ResourceTreeItem
  | UriTreeItem;

export class SmartFoldersProvider extends BaseTreeProvider<Element> {
  public providerId = 'smart-folders';
  public groupBy: ContextMemento<'off' | 'folder'>;
  // Cleared on every `refresh()`. Each top-level expansion re-runs every
  // saved query; on workspaces with many large filters that adds up.
  private uriCache = new Map<string, URI[]>();

  constructor(
    private workspace: FoamWorkspace,
    private graph: FoamGraph,
    private storage: SmartFolderStorage,
    state: vscode.Memento,
    /**
     * Reads the current workspace trust state at execution time. Smart Folder
     * queries can contain Jexl expressions, which must only run in a trusted
     * workspace (matches the same gate used by `foam-query` blocks).
     * Defaults to `() => false` so callers that forget to pass it fail safe.
     */
    private isTrusted: () => boolean = () => false,
    registerCommands: boolean = true
  ) {
    super();
    this.groupBy = new ContextMemento<'off' | 'folder'>(
      state,
      `foam-vscode.views.${this.providerId}.group-by`,
      'folder'
    );

    if (!registerCommands) return;
    this.disposables.push(
      vscode.commands.registerCommand(
        `foam-vscode.views.${this.providerId}.group-by:folder`,
        () => {
          this.groupBy.update('folder');
          this.refresh();
        }
      ),
      vscode.commands.registerCommand(
        `foam-vscode.views.${this.providerId}.group-by:off`,
        () => {
          this.groupBy.update('off');
          this.refresh();
        }
      )
    );
  }

  refresh(): void {
    this.uriCache.clear();
    super.refresh();
  }

  async getChildren(element?: Element): Promise<Element[]> {
    if (!element) {
      return this.storage.list().map(loaded => {
        if (loaded.errors.length > 0) {
          return new SmartFolderErrorTreeItem(loaded);
        }
        const uris = this.getOrComputeUris(loaded);
        return new SmartFolderTreeItem(loaded, uris);
      });
    }

    if (element instanceof SmartFolderTreeItem) {
      return this.buildFolderChildren(element.uris, undefined);
    }

    if (element instanceof FolderTreeItem) {
      return this.buildFolderChildrenFromNode(element.node);
    }

    return [];
  }

  private getOrComputeUris(loaded: LoadedQuery): URI[] {
    const cached = this.uriCache.get(loaded.query.id);
    if (cached) return cached;
    const uris = this.executeQueryForFolder(loaded);
    this.uriCache.set(loaded.query.id, uris);
    return uris;
  }

  // Errors are swallowed (logged) so a single broken query can't take the
  // tree view down with it.
  private executeQueryForFolder(loaded: LoadedQuery): URI[] {
    try {
      const { results, warnings } = executeQuery(
        loaded.query.descriptor,
        this.workspace,
        this.graph,
        { trusted: this.isTrusted() }
      );
      if (warnings.length > 0) {
        Logger.warn(
          `Smart folder "${loaded.query.id}" produced warnings: ${warnings.join('; ')}`
        );
      }
      return results.map(r => r.uri);
    } catch (e) {
      Logger.error(
        `Failed to execute smart folder "${loaded.query.id}"`,
        e
      );
      return [];
    }
  }

  private buildFolderChildren(
    uris: URI[],
    parent: FolderTreeItem<URI> | undefined
  ): Element[] {
    if (this.groupBy.get() === 'off') {
      return uris.map(uri => this.createValueTreeItem(uri));
    }
    const root = buildFolderTree(uris, this.workspace);
    return this.buildFolderChildrenFromNode(root, parent);
  }

  private buildFolderChildrenFromNode(
    node: Folder<URI>,
    parent?: FolderTreeItem<URI>
  ): Element[] {
    const items: Element[] = [];
    for (const name of Object.keys(node.children).sort()) {
      const child = node.children[name];
      if (child.value !== undefined) {
        items.push(this.createValueTreeItem(child.value, parent));
      } else {
        const folderItem = new FolderTreeItem<URI>(child, name, parent);
        folderItem.description = `(${countLeaves(child)})`;
        items.push(folderItem);
      }
    }
    return items;
  }

  private createValueTreeItem(
    uri: URI,
    parent?: vscode.TreeItem
  ): ResourceTreeItem | UriTreeItem {
    const resource = this.workspace.find(uri);
    if (resource) {
      return new ResourceTreeItem(resource, this.workspace, { parent });
    }
    return new UriTreeItem(uri, { parent });
  }
}

/** Top-level tree item representing a saved query rendered as a Smart Folder. */
export class SmartFolderTreeItem extends vscode.TreeItem {
  contextValue = 'smart-folder';

  constructor(
    public readonly loaded: LoadedQuery,
    public readonly uris: URI[]
  ) {
    super(loaded.query.name, vscode.TreeItemCollapsibleState.Collapsed);
    this.description = `${uris.length}`;
    this.tooltip =
      loaded.query.description ??
      `Smart folder "${loaded.query.name}" — ${uris.length} note${uris.length === 1 ? '' : 's'}`;
    this.iconPath = new vscode.ThemeIcon('folder-library');
    this.id = `smart-folder:${loaded.query.id}`;
    this.resourceUri = toVsCodeUri(loaded.uri);
  }
}

/** Top-level tree item shown when a query file has parse errors. */
export class SmartFolderErrorTreeItem extends vscode.TreeItem {
  contextValue = 'smart-folder-error';

  constructor(public readonly loaded: LoadedQuery) {
    super(loaded.query.name, vscode.TreeItemCollapsibleState.None);
    this.description = 'errors';
    this.tooltip = loaded.errors.join('\n');
    this.iconPath = new vscode.ThemeIcon(
      'warning',
      new vscode.ThemeColor('list.warningForeground')
    );
    this.id = `smart-folder-error:${loaded.query.id}`;
    this.resourceUri = toVsCodeUri(loaded.uri);
    this.command = {
      command: 'vscode.open',
      arguments: [toVsCodeUri(loaded.uri)],
      title: 'Open Query File',
    };
  }
}

/** Group note URIs into a tree keyed by their workspace-relative path. */
export function buildFolderTree(
  uris: URI[],
  workspace: FoamWorkspace
): Folder<URI> {
  const root: Folder<URI> = { children: {}, path: [] };
  for (const uri of uris) {
    const relative = uriToWorkspacePath(uri, workspace);
    const parts = relative.split('/').filter(Boolean);
    if (parts.length === 0) continue;

    let current = root;
    parts.forEach((part, i) => {
      if (i === parts.length - 1) {
        current.children[part] = {
          children: {},
          path: [...current.path, part],
          value: uri,
        };
      } else {
        if (!current.children[part]) {
          current.children[part] = {
            children: {},
            path: [...current.path, part],
          };
        }
        current = current.children[part];
      }
    });
  }
  return root;
}

function countLeaves(node: Folder<URI>): number {
  let n = 0;
  for (const child of Object.values(node.children)) {
    if (child.value !== undefined) n += 1;
    else n += countLeaves(child);
  }
  return n;
}
