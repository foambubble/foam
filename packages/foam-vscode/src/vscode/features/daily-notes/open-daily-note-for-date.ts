import { ExtensionContext, commands, window, QuickPickItem } from 'vscode';
import { openDailyNoteFor } from './daily-note-service';
import { FoamWorkspace } from '@foam/core';
import { range } from 'lodash';
import dayjs from 'dayjs';
import { Foam } from '@foam/core';

export default async function activate(
  context: ExtensionContext,
  foamPromise: Promise<Foam>
) {
  context.subscriptions.push(
    commands.registerCommand(
      'foam-vscode.open-daily-note-for-date',
      async () => {
        const ws = (await foamPromise).workspace;
        const date = await window
          .showQuickPick<DateItem>(generateDateItems(ws), {
            placeHolder: 'Choose or type a date (YYYY-MM-DD)',
            matchOnDescription: true,
            matchOnDetail: true,
          })
          .then(item => {
            return item?.date;
          });
        return openDailyNoteFor(date, await foamPromise);
      }
    )
  );
}

class DateItem implements QuickPickItem {
  public label: string;
  public detail: string;
  public description: string;
  public alwaysShow?: boolean;
  constructor(public date: Date, offset: number, public exists: boolean) {
    const icon = exists ? '$(calendar)' : '$(new-file)';
    this.label = `${icon} ${dayjs(date).format('MMM DD, YYYY')}`;
    this.detail = dayjs(date).format('dddd');
    if (offset === 0) {
      this.detail = 'Today';
    } else if (offset === -1) {
      this.detail = 'Yesterday';
    } else if (offset === 1) {
      this.detail = 'Tomorrow';
    } else if (offset > -8 && offset < -1) {
      this.detail = `Last ${dayjs(date).format('dddd')}`;
    } else if (offset > 1 && offset < 8) {
      this.detail = `Next ${dayjs(date).format('dddd')}`;
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
    const noteBasename = dayjs(date).format('YYYY-MM-DD');
    const exists = ws.find(noteBasename) ? true : false;
    return new DateItem(date, offset, exists);
  });

  return items;
}
