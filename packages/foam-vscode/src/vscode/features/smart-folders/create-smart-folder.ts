import * as vscode from 'vscode';
import { FoamTags, QueryFilter, sanitizeQueryId } from '@foam/core';
import { SmartFolderStorage } from './smart-folder-storage';
import { toVsCodeUri } from '../../utils/vsc-utils';

/**
 * Walks the user through creating a new Smart Folder via Quick Picks.
 * The minimal flow is: name → pick tags from existing workspace tags.
 * The resulting YAML file is opened for further editing.
 */
export async function createSmartFolder(
  storage: SmartFolderStorage,
  foamTags: FoamTags
): Promise<void> {
  const name = await vscode.window.showInputBox({
    title: 'New Smart Folder',
    prompt: 'Name for the Smart Folder',
    placeHolder: 'e.g. Work in Progress',
    validateInput: value => {
      if (!value || !value.trim()) return 'Name is required';
      return null;
    },
  });
  if (!name) return;

  const baseId = sanitizeQueryId(name);
  if (!baseId) {
    vscode.window.showErrorMessage(
      'The name produces an empty id. Use letters, numbers, hyphens, or underscores.'
    );
    return;
  }
  const id = await uniqueId(baseId, storage);

  const allTags = Array.from(foamTags.tags.keys()).sort();

  // Skip the picker entirely when the workspace has no tags — showing an
  // empty Quick Pick would be a dead end. The user gets a `*` filter and
  // edits the YAML to refine it.
  let pickedTags: vscode.QuickPickItem[] | undefined;
  if (allTags.length > 0) {
    const tagItems: vscode.QuickPickItem[] = allTags.map(t => ({ label: t }));
    pickedTags = await vscode.window.showQuickPick(tagItems, {
      title: 'Select tags to include (optional — press Esc to skip and edit YAML manually)',
      placeHolder: 'Notes matching ANY selected tag will be shown',
      canPickMany: true,
    });
  }

  const filter: QueryFilter | undefined =
    pickedTags && pickedTags.length > 0
      ? buildOrFilter(pickedTags.map(p => p.label))
      : '*';

  const uri = await storage.save({
    id,
    name,
    descriptor: { filter },
  });

  await vscode.window.showTextDocument(toVsCodeUri(uri));
}

function buildOrFilter(tags: string[]): QueryFilter {
  if (tags.length === 1) {
    return { tag: tags[0] };
  }
  return { or: tags.map(t => ({ tag: t })) };
}

async function uniqueId(
  baseId: string,
  storage: SmartFolderStorage
): Promise<string> {
  if (!(await storage.exists(baseId))) return baseId;
  let i = 2;
  while (i < 1000) {
    const candidate = `${baseId}-${i}`;
    if (!(await storage.exists(candidate))) return candidate;
    i += 1;
  }
  throw new Error(`Failed to generate a unique id for the smart folder`);
}

/**
 * Confirms with the user and deletes the smart folder file. Triggered from
 * the tree view context menu.
 */
export async function deleteSmartFolder(
  storage: SmartFolderStorage,
  id: string,
  displayName: string
): Promise<void> {
  const choice = await vscode.window.showWarningMessage(
    `Delete smart folder "${displayName}"?`,
    { modal: true },
    'Delete'
  );
  if (choice !== 'Delete') return;
  await storage.delete(id);
}
