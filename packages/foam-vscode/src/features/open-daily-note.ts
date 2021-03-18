import { ExtensionContext, commands, workspace } from 'vscode';
import { FoamFeature } from '../types';
import { openDailyNoteFor } from '../dated-notes';

const feature: FoamFeature = {
  activate: (context: ExtensionContext) => {
    context.subscriptions.push(
      commands.registerCommand('foam-vscode.open-daily-note', openDailyNoteFor)
    );
    if (
      workspace.getConfiguration('foam').get('openDailyNote.onStartup', false)
    ) {
      commands.executeCommand('foam-vscode.open-daily-note');
    }
  },
};

export default feature;
