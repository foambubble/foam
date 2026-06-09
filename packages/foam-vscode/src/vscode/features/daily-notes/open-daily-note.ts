import { ExtensionContext, commands } from 'vscode';
import { getFoamVsCodeConfig } from '../../../vscode/config';
import { openDailyNoteFor } from './daily-note-service';
import { Foam } from '@foam/core';
import { getTelemetry } from '../../services/telemetry';

export default async function activate(
  context: ExtensionContext,
  foamPromise: Promise<Foam>
) {
  context.subscriptions.push(
    commands.registerCommand('foam-vscode.open-daily-note', async () => {
      getTelemetry()?.trackCommand('foam-vscode.open-daily-note');
      return openDailyNoteFor(new Date(), await foamPromise);
    })
  );

  if (getFoamVsCodeConfig('openDailyNote.onStartup', false)) {
    commands.executeCommand('foam-vscode.open-daily-note');
  }
}
