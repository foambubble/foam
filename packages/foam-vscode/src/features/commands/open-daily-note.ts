import { ExtensionContext, commands } from 'vscode';
import { getFoamVsCodeConfig } from '../../services/config';
import { openDailyNoteFor } from '../../dated-notes';

export default async function activate(context: ExtensionContext) {
  context.subscriptions.push(
    commands.registerCommand('foam-vscode.open-daily-note', () =>
      openDailyNoteFor(new Date())
    )
  );

  if (getFoamVsCodeConfig('openDailyNote.onStartup', false)) {
    commands.executeCommand('foam-vscode.open-daily-note');
  }
}
