import { ExtensionContext } from 'vscode';
import { Foam } from '@foam/core';
import { FoamFeatureResult } from '../../../types';
import { getDailyNoteTemplateUri } from '../../services/template-service';
import dateSnippets from './date-snippets';
import openDailyNoteCommand from './open-daily-note';
import openDailyNoteForDateCommand from './open-daily-note-for-date';
import openDatedNote from './open-dated-note';

export default async function activate(
  context: ExtensionContext,
  foamPromise: Promise<Foam>
): Promise<FoamFeatureResult> {
  await dateSnippets(context);
  await openDailyNoteCommand(context, foamPromise);
  await openDailyNoteForDateCommand(context, foamPromise);
  await openDatedNote(context, foamPromise);

  const hasDailyNoteTemplate = (await getDailyNoteTemplateUri()) !== undefined;
  return {
    telemetry: { hasDailyNoteTemplate: String(hasDailyNoteTemplate) },
  };
}
