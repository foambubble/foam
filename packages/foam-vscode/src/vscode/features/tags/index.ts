import { ExtensionContext } from 'vscode';
import { Foam } from '@foam/core';
import tagCompletionProvider from './tag-completion';
import tagRenameProvider from './tag-rename-provider';
import tagsExplorer from './tags-explorer';
import searchTagCommand from './search-tag';
import renameTagCommand from './rename-tag';

export default async function activate(
  context: ExtensionContext,
  foamPromise: Promise<Foam>
) {
  await tagCompletionProvider(context, foamPromise);
  await tagRenameProvider(context, foamPromise);
  await tagsExplorer(context, foamPromise);
  await searchTagCommand(context, foamPromise);
  await renameTagCommand(context, foamPromise);
}
