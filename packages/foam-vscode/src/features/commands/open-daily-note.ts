import { ExtensionContext, commands } from 'vscode';
import { getFoamVsCodeConfig } from '../../services/config';
import { openDailyNoteFor } from '../../dated-notes';
import { Foam } from '../../core/model/foam';

export default async function activate(
  context: ExtensionContext,
  foamPromise: Promise<Foam>
) {
  context.subscriptions.push(
    commands.registerCommand('foam-vscode.open-daily-note', async () =>
      openDailyNoteFor(new Date(), await foamPromise)
    )
  );

  if (getFoamVsCodeConfig('openDailyNote.onStartup', false)) {
    commands.executeCommand('foam-vscode.open-daily-note');
  }
}
