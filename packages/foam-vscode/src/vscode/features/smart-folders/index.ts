import * as vscode from 'vscode';
import { Foam } from '@foam/core';
import { fromVsCodeUri, toVsCodeUri } from '../../utils/vsc-utils';
import { SmartFolderStorage } from './smart-folder-storage';
import {
  SmartFolderErrorTreeItem,
  SmartFolderTreeItem,
  SmartFoldersProvider,
} from './smart-folders-explorer';
import {
  createSmartFolder,
  deleteSmartFolder,
} from './create-smart-folder';

export default async function activate(
  context: vscode.ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const foam = await foamPromise;

  const root = vscode.workspace.workspaceFolders?.[0]
    ? fromVsCodeUri(vscode.workspace.workspaceFolders[0].uri)
    : undefined;

  const storage = new SmartFolderStorage(root);
  await storage.start();

  const provider = new SmartFoldersProvider(
    foam.workspace,
    foam.graph,
    storage,
    context.globalState,
    () => vscode.workspace.isTrusted
  );

  const treeView = vscode.window.createTreeView('foam-vscode.smart-folders', {
    treeDataProvider: provider,
    showCollapseAll: true,
  });

  const refresh = () => provider.refresh();

  context.subscriptions.push(
    treeView,
    storage,
    provider,
    storage.onDidUpdate(refresh),
    foam.graph.onDidUpdate(refresh),
    vscode.workspace.onDidGrantWorkspaceTrust(refresh),
    vscode.commands.registerCommand(
      'foam-vscode.views.smart-folders.create',
      () => createSmartFolder(storage, foam.tags)
    ),
    vscode.commands.registerCommand(
      'foam-vscode.views.smart-folders.edit',
      async (item?: SmartFolderTreeItem | SmartFolderErrorTreeItem) => {
        const target =
          item?.loaded?.uri ??
          (await pickSmartFolderUri(storage));
        if (target) {
          await vscode.window.showTextDocument(toVsCodeUri(target));
        }
      }
    ),
    vscode.commands.registerCommand(
      'foam-vscode.views.smart-folders.delete',
      async (item?: SmartFolderTreeItem | SmartFolderErrorTreeItem) => {
        if (!item) return;
        await deleteSmartFolder(
          storage,
          item.loaded.query.id,
          item.loaded.query.name
        );
      }
    ),
    vscode.commands.registerCommand(
      'foam-vscode.views.smart-folders.refresh',
      refresh
    )
  );
}

async function pickSmartFolderUri(storage: SmartFolderStorage) {
  const list = storage.list();
  if (list.length === 0) return undefined;
  const pick = await vscode.window.showQuickPick(
    list.map(l => ({ label: l.query.name, description: l.query.id, uri: l.uri })),
    { title: 'Select a Smart Folder to edit' }
  );
  return pick?.uri;
}
