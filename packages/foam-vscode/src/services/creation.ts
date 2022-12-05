import {
  askUserForTemplate,
  getDefaultTemplateUri,
  getPathFromTitle,
  NoteFactory,
} from './templates';

import { Resolver } from './variable-resolver';
import { asAbsoluteWorkspaceUri, fileExists } from './editor';
import { isSome } from '../core/utils';

import { URI } from '../core/model/uri';

export interface CreateNoteArgs {
  /**
   * The dir of the note to locate in.
   * absolute path.
   */
  noteDir?: string;
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
   * Whether to ask the user to select a template for the new note. If so, overwrites templatePath.
   */
  askForTemplate?: boolean;
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

export async function createNote(args: CreateNoteArgs | undefined) {
  args = args ?? {};
  const date = isSome(args.date) ? new Date(Date.parse(args.date)) : new Date();
  const resolver = new Resolver(
    new Map(Object.entries(args.variables ?? {})),
    date
  );
  const text = args.text ?? DEFAULT_NEW_NOTE_TEXT;
  const noteUri =
    args.notePath && asAbsoluteWorkspaceUri(URI.file(args.notePath));
  const noteDir = args.noteDir && URI.file(args.noteDir)
  let templateUri: URI;
  if (args.askForTemplate) {
    const selectedTemplate = await askUserForTemplate();
    if (selectedTemplate) {
      templateUri = selectedTemplate;
    } else {
      return;
    }
  } else {
    templateUri = args.templatePath
      ? asAbsoluteWorkspaceUri(URI.file(args.templatePath))
      : getDefaultTemplateUri();
  }

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
      noteUri ?? (await getPathFromTitle(resolver, noteDir)),
      text,
      resolver,
      args.onFileExists
    );
  }
}
