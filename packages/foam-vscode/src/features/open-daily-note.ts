import { ExtensionContext, commands } from 'vscode';
import { FoamFeature } from '../types';
import { openDailyNoteFor } from '../dated-notes';
import { getFoamVsCodeConfig } from '../services/config';

const feature: FoamFeature = {
  activate: (context: ExtensionContext) => {
    context.subscriptions.push(
      commands.registerCommand('foam-vscode.open-daily-note', openDailyNoteFor)
    );

    if (getFoamVsCodeConfig('openDailyNote.onStartup', false)) {
      commands.executeCommand('foam-vscode.open-daily-note');
    }
  },
};

export default feature;
