import { ExtensionContext } from 'vscode';
import { Foam } from '@foam/core';
import dateSnippets from './date-snippets';
import openDailyNoteCommand from './open-daily-note';
import openDailyNoteForDateCommand from './open-daily-note-for-date';
import openDatedNote from './open-dated-note';

export default async function activate(
  context: ExtensionContext,
  foamPromise: Promise<Foam>
) {
  await dateSnippets(context);
  await openDailyNoteCommand(context, foamPromise);
  await openDailyNoteForDateCommand(context, foamPromise);
  await openDatedNote(context, foamPromise);
}
