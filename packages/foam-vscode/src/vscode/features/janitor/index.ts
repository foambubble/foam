import { ExtensionContext } from 'vscode';
import { Foam } from '../../../core/model/foam';
import janitorCommand from './commands';
import wikilinkDiagnostics from './wikilink-diagnostics';

export default async function activate(
  context: ExtensionContext,
  foamPromise: Promise<Foam>
) {
  await janitorCommand(context, foamPromise);
  await wikilinkDiagnostics(context, foamPromise);
}
