import { ExtensionContext, commands } from 'vscode';
import { Foam } from '../../core/model/foam';
import { getFoamVsCodeConfig } from '../../vscode/config';
import {
  createDailyNoteIfNotExists,
  openDailyNoteFor,
} from '../daily-notes/daily-note-service';

export default async function activate(
  context: ExtensionContext,
  foamPromise: Promise<Foam>
) {
  context.subscriptions.push(
    commands.registerCommand('foam-vscode.open-dated-note', async date => {
      const foam = await foamPromise;
      switch (getFoamVsCodeConfig('dateSnippets.afterCompletion')) {
        case 'navigateToNote':
          return openDailyNoteFor(date, foam);
        case 'createNote':
          return createDailyNoteIfNotExists(date, foam);
      }
    })
  );
}
