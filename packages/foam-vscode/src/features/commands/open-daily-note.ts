import { ExtensionContext, commands, QuickPickItem } from 'vscode';
import { FoamFeature } from '../../types';
import { getFoamVsCodeConfig } from '../../services/config';
import { openDailyNoteFor } from '../../dated-notes';
import { FoamWorkspace } from '../../core/model/workspace';
import { range } from 'lodash';
import dateFormat from 'dateformat';

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

class DateItem implements QuickPickItem {
  public label: string;
  public detail: string;
  public description: string;
  public alwaysShow?: boolean;
  constructor(public date: Date, offset: number, public exists: boolean) {
    const icon = exists ? '$(calendar)' : '$(new-file)';
    this.label = `${icon} ${dateFormat(date, 'mmm dd, yyyy')}`;
    this.detail = dateFormat(date, 'dddd');
    if (offset === 0) {
      this.detail = 'Today';
    } else if (offset === -1) {
      this.detail = 'Yesterday';
    } else if (offset === 1) {
      this.detail = 'Tomorrow';
    } else if (offset > -8 && offset < -1) {
      this.detail = `Last ${dateFormat(date, 'dddd')}`;
    } else if (offset > 1 && offset < 8) {
      this.detail = `Next ${dateFormat(date, 'dddd')}`;
    }
  }
}

function generateDateItems(ws: FoamWorkspace): DateItem[] {
  const items = [
    ...range(0, 32), // next month
    ...range(-31, 0), // last month
  ].map(offset => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    // TODO this is only compatible with default settings as it would
    // be otherwise hard to "guess" the daily note path
    // Ideally we would read the daily note path from the config or template to properly match
    const noteBasename = dateFormat(date, 'yyyy-mm-dd', false);
    const exists = ws.find(noteBasename) ? true : false;
    return new DateItem(date, offset, exists);
  });

  return items;
}

export default feature;