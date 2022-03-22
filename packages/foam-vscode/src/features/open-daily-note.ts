import { ExtensionContext, commands } from 'vscode';
import { FoamFeature } from '../types';
import { getFoamVsCodeConfig } from '../services/config';
import {
  openDailyNoteForPickedDate,
  openDailyNoteForToday,
} from '../dated-notes';

const feature: FoamFeature = {
  activate: (context: ExtensionContext) => {
    context.subscriptions.push(
      commands.registerCommand(
        'foam-vscode.open-daily-note',
        openDailyNoteForToday
      )
    );

    context.subscriptions.push(
      commands.registerCommand(
        'foam-vscode.open-daily-note-for-date',
        openDailyNoteForPickedDate
      )
    );

    if (getFoamVsCodeConfig('openDailyNote.onStartup', false)) {
      commands.executeCommand('foam-vscode.open-daily-note');
    }
  },
};

export default feature;
