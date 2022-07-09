import { ExtensionContext, commands } from 'vscode';
import { FoamFeature } from '../../types';
import { getFoamVsCodeConfig } from '../../services/config';
import { openDailyNoteFor } from '../../dated-notes';

const feature: FoamFeature = {
  activate: (context: ExtensionContext, foamPromise) => {
    context.subscriptions.push(
      commands.registerCommand('foam-vscode.open-daily-note', () =>
        openDailyNoteFor(new Date())
      )
    );

    if (getFoamVsCodeConfig('openDailyNote.onStartup', false)) {
      commands.executeCommand('foam-vscode.open-daily-note');
    }
  },
};

export default feature;
