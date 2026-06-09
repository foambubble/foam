import { ExtensionContext } from 'vscode';
import { Foam } from '@foam/core';
import createNote from './create-note';
import createFromTemplateCommand from './create-note-from-template';
import createNewTemplate from './create-new-template';
import updateGraphCommand from './update-graph';
import notesExplorer from './notes-explorer';
import orphans from './orphans';
import placeholders from './placeholders';
import backlinks from './connections';

export default async function activate(
  context: ExtensionContext,
  foamPromise: Promise<Foam>
) {
  await createNote(context, foamPromise);
  await createFromTemplateCommand(context, foamPromise);
  await createNewTemplate(context);
  await updateGraphCommand(context, foamPromise);
  await notesExplorer(context, foamPromise);
  await orphans(context, foamPromise);
  await placeholders(context, foamPromise);
  await backlinks(context, foamPromise);
}
