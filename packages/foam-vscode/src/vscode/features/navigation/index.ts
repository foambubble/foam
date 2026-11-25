import { ExtensionContext } from 'vscode';
import { Foam } from '@foam/core';
import navigationProviders from './navigation-provider';
import hoverProvider from './hover-provider';
import completionProvider from './link-completion';
import workspaceSymbolProvider from './workspace-symbol-provider';
import openResource from './open-resource';
import openRandomNoteCommand from './open-random-note';
import goToNoteCommand from './go-to-note';

export default async function activate(
  context: ExtensionContext,
  foamPromise: Promise<Foam>
) {
  await navigationProviders(context, foamPromise);
  await hoverProvider(context, foamPromise);
  await completionProvider(context, foamPromise);
  await workspaceSymbolProvider(context, foamPromise);
  await openResource(context, foamPromise);
  await openRandomNoteCommand(context, foamPromise);
  await goToNoteCommand(context, foamPromise);
}
