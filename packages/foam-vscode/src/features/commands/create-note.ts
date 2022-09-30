import * as vscode from 'vscode';
import { FoamFeature } from '../../types';
import { URI } from '../../core/model/uri';
import { getPathFromTitle, NoteFactory } from '../../services/templates';
import { Foam } from '../../core/model/foam';
import { Resolver } from '../../services/variable-resolver';
import { asAbsoluteWorkspaceUri, fileExists } from '../../services/editor';
import { isSome, isNone } from '../../core/utils';

interface CreateNoteArgs {
  /**
   * The path of the note to create.
   * If relative it will be resolved against the workspace root.
   */
  notePath?: string;
  /**
   * The path of the template to use.
   */
  templatePath?: string;
  /**
   * The text to use for the note.
   * If a template is provided, the template has precedence
   */
  text?: string;
  /**
   * Variables to use in the text or template
   */
  variables?: Map<string, string>;
  /**
   * The date used to resolve the FOAM_DATE_* variables. in YYYY-MM-DD format
   */
  date?: string;
  /**
   * What to do in case the target file already exists
   */
  onFileExists?: 'overwrite' | 'open' | 'ask' | 'cancel';
}

const DEFAULT_NEW_NOTE_TEXT = `# \${FOAM_TITLE}

\${FOAM_SELECTED_TEXT}`;

async function createNote(args: CreateNoteArgs) {
  args = args ?? {};
  const date = isSome(args.date) ? new Date(Date.parse(args.date)) : new Date();
  const resolver = new Resolver(
    new Map(Object.entries(args.variables ?? {})),
    date
  );
  const text = args.text ?? DEFAULT_NEW_NOTE_TEXT;
  const noteUri =
    args.notePath && asAbsoluteWorkspaceUri(URI.file(args.notePath));
  const templateUri =
    args.templatePath && asAbsoluteWorkspaceUri(URI.file(args.templatePath));

  if (await fileExists(templateUri)) {
    return NoteFactory.createFromTemplate(
      templateUri,
      resolver,
      noteUri,
      text,
      args.onFileExists
    );
  } else {
    return NoteFactory.createNote(
      noteUri ?? (await getPathFromTitle(resolver)),
      text,
      resolver,
      args.onFileExists
    );
  }
}

export const CREATE_NOTE_COMMAND = {
  command: 'foam-vscode.create-note',
  title: 'Foam: Create Note',

  asURI: (args: CreateNoteArgs) =>
    vscode.Uri.parse(`command:${CREATE_NOTE_COMMAND.command}`).with({
      query: encodeURIComponent(JSON.stringify(args)),
    }),
};

const feature: FoamFeature = {
  activate: (context: vscode.ExtensionContext, foamPromise: Promise<Foam>) => {
    context.subscriptions.push(
      vscode.commands.registerCommand(CREATE_NOTE_COMMAND.command, createNote)
    );
  },
};

export default feature;
