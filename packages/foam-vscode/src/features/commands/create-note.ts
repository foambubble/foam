import * as vscode from 'vscode';
import { URI } from '../../core/model/uri';
import {
  askUserForTemplate,
  getDefaultTemplateUri,
  getPathFromTitle,
  NoteFactory,
} from '../../services/templates';
import { Resolver } from '../../services/variable-resolver';
import { asAbsoluteWorkspaceUri, fileExists } from '../../services/editor';
import { isSome } from '../../core/utils';
import { CommandDescriptor } from '../../utils/commands';
import { Foam } from '../../core/model/foam';
import { Location } from '../../core/model/location';
import { MarkdownLink } from '../../core/services/markdown-link';
import { ResourceLink } from '../../core/model/note';
import { toVsCodeRange, toVsCodeUri } from '../../utils/vsc-utils';

export default async function activate(
  context: vscode.ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const foam = await foamPromise;
  context.subscriptions.push(
    vscode.commands.registerCommand(CREATE_NOTE_COMMAND.command, args =>
      createNote(args, foam)
    )
  );
}

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
  variables?: { [key: string]: string };
  /**
   * The date used to resolve the FOAM_DATE_* variables. in YYYY-MM-DD format
   */
  date?: string;
  /**
   * The title of the note (translates into the FOAM_TITLE variable)
   */
  title?: string;
  /**
   * The source link that triggered the creation of the note.
   * It will be updated with the appropriate identifier to the note, if necessary.
   */
  sourceLink?: Location<ResourceLink>;
  /**
   * What to do in case the target file already exists
   */
  onFileExists?: 'overwrite' | 'open' | 'ask' | 'cancel';
  /**
   * What to do if the new note path is relative
   */
  onRelativeNotePath?:
    | 'resolve-from-root'
    | 'resolve-from-current-dir'
    | 'ask'
    | 'cancel';
}

const DEFAULT_NEW_NOTE_TEXT = `# \${FOAM_TITLE}

\${FOAM_SELECTED_TEXT}`;

export async function createNote(args: CreateNoteArgs, foam: Foam) {
  args = args ?? {};
  const date = isSome(args.date) ? new Date(Date.parse(args.date)) : new Date();
  const resolver = new Resolver(
    new Map(Object.entries(args.variables ?? {})),
    date
  );
  if (args.title) {
    resolver.define('FOAM_TITLE', args.title);
  }
  const text = args.text ?? DEFAULT_NEW_NOTE_TEXT;
  const noteUri = args.notePath && asAbsoluteWorkspaceUri(args.notePath);
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
      ? asAbsoluteWorkspaceUri(args.templatePath)
      : getDefaultTemplateUri();
  }

  const createdNote = (await fileExists(templateUri))
    ? await NoteFactory.createFromTemplate(
        templateUri,
        resolver,
        noteUri,
        text,
        args.onFileExists
      )
    : await NoteFactory.createNote(
        noteUri ?? (await getPathFromTitle(templateUri.scheme, resolver)),
        text,
        resolver,
        args.onFileExists,
        args.onRelativeNotePath
      );

  if (args.sourceLink) {
    const identifier = foam.workspace.getIdentifier(createdNote.uri);
    const edit = MarkdownLink.createUpdateLinkEdit(args.sourceLink.data, {
      target: identifier,
    });
    if (edit.newText !== args.sourceLink.data.rawText) {
      const updateLink = new vscode.WorkspaceEdit();
      const uri = toVsCodeUri(args.sourceLink.uri);
      updateLink.replace(
        uri,
        toVsCodeRange(args.sourceLink.range),
        edit.newText
      );
      await vscode.workspace.applyEdit(updateLink);
    }
  }
  return createdNote;
}

export const CREATE_NOTE_COMMAND = {
  command: 'foam-vscode.create-note',

  /**
   * Creates a command descriptor to create a note from the given placeholder.
   *
   * @param placeholder the placeholder
   * @param defaultExtension the default extension (e.g. '.md')
   * @param extra extra command arguments
   * @returns the command descriptor
   */
  forPlaceholder: (
    sourceLink: Location<ResourceLink>,
    defaultExtension: string,
    extra: Partial<CreateNoteArgs> = {}
  ): CommandDescriptor<CreateNoteArgs> => {
    const endsWithDefaultExtension = new RegExp(defaultExtension + '$');
    const { target: placeholder } = MarkdownLink.analyzeLink(sourceLink.data);
    const title = placeholder.endsWith(defaultExtension)
      ? placeholder.replace(endsWithDefaultExtension, '')
      : placeholder;
    const notePath = placeholder.endsWith(defaultExtension)
      ? placeholder
      : placeholder + defaultExtension;
    return {
      name: CREATE_NOTE_COMMAND.command,
      params: {
        title,
        notePath,
        sourceLink,
        ...extra,
      },
    };
  },
};
