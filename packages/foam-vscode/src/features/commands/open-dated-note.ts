import { ExtensionContext, commands } from 'vscode';
import { FoamFeature } from '../../types';
import { getFoamVsCodeConfig } from '../../services/config';
import {
  createDailyNoteIfNotExists,
  openDailyNoteFor,
} from '../../dated-notes';

const feature: FoamFeature = {
  activate: (context: ExtensionContext) => {
    context.subscriptions.push(
      commands.registerCommand('foam-vscode.open-dated-note', date => {
        switch (getFoamVsCodeConfig('dateSnippets.afterCompletion')) {
          case 'navigateToNote':
            return openDailyNoteFor(date);
          case 'createNote':
            return createDailyNoteIfNotExists(date);
        }
      })
    );
  },
};

export default feature;
