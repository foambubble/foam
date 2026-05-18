import { ExtensionContext } from 'vscode';
import { Foam } from '@foam/core';
import lintCommand from './commands';
import wikilinkDiagnostics from './wikilink-diagnostics';

export default async function activate(
  context: ExtensionContext,
  foamPromise: Promise<Foam>
) {
  await lintCommand(context, foamPromise);
  await wikilinkDiagnostics(context, foamPromise);
}
