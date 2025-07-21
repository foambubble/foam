import { workspace, commands, WorkspaceEdit, ExtensionContext } from 'vscode';
import { URI } from '../../core/model/uri';
import {
  askUserForTemplate,
  getDefaultTemplateUri,
  NoteFactory,
} from '../../services/templates';
import { NoteCreationEngine } from '../../services/note-creation-engine';
import { TriggerFactory } from '../../services/note-creation-triggers';
import { TemplateLoader } from '../../services/template-loader';
import { Template } from '../../services/note-creation-types';
import { Resolver } from '../../services/variable-resolver';
import { asAbsoluteWorkspaceUri, fileExists } from '../../services/editor';
import { isSome } from '../../core/utils';
import { CommandDescriptor } from '../../utils/commands';
import { Foam } from '../../core/model/foam';
import { Location } from '../../core/model/location';
import { MarkdownLink } from '../../core/services/markdown-link';
import { ResourceLink } from '../../core/model/note';
import {
  fromVsCodeUri,
  toVsCodeRange,
  toVsCodeUri,
} from '../../utils/vsc-utils';

export default async function activate(
  context: ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const foam = await foamPromise;
  context.subscriptions.push(
    commands.registerCommand(CREATE_NOTE_COMMAND.command, args =>
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

  // Create appropriate trigger based on context
  const trigger = args.sourceLink
    ? TriggerFactory.createPlaceholderTrigger(
        args.sourceLink.uri,
        foam.workspace.find(new URI(args.sourceLink.uri))?.title || 'Unknown',
        args.sourceLink
      )
    : TriggerFactory.createCommandTrigger('foam-vscode.create-note');

  // Determine template path
  let templatePath: string;
  if (args.askForTemplate) {
    const selectedTemplate = await askUserForTemplate();
    if (selectedTemplate) {
      templatePath = selectedTemplate.toString();
    } else {
      return;
    }
  } else {
    templatePath = args.templatePath
      ? asAbsoluteWorkspaceUri(args.templatePath).toString()
      : (await getDefaultTemplateUri())?.toString();
  }

  // Load template using the new system
  const templateLoader = new TemplateLoader();
  let template: Template;

  try {
    if (!templatePath) {
      template = {
        type: 'markdown',
        content: args.text || DEFAULT_NEW_NOTE_TEXT,
      };
    } else if (await fileExists(URI.parse(templatePath))) {
      template = await templateLoader.loadTemplate(templatePath);
    } else {
      throw new Error(`Template file not found: ${templatePath}`);
    }
  } catch (error) {
    throw new Error(
      `Failed to load template (${templatePath}): ${error.message}`
    );
  }

  // If notePath is provided, add it to template metadata to avoid unnecessary title resolution
  if (args.notePath && template.type === 'markdown') {
    template.metadata = template.metadata || new Map();
    template.metadata.set('filepath', args.notePath);
  }

  // Create resolver with all variables upfront
  const resolver = new Resolver(
    new Map(Object.entries(args.variables ?? {})),
    date
  );

  // Define all variables in the resolver with proper mapping
  if (args.title) {
    resolver.define('FOAM_TITLE', args.title);
  }

  // Add other parameters as variables
  if (args.notePath) {
    resolver.define('notePath', args.notePath);
  }

  // Process template using the new engine with unified resolver
  const engine = new NoteCreationEngine(
    foam,
    workspace.workspaceFolders.map(folder => fromVsCodeUri(folder.uri))
  );
  const result = await engine.processTemplate(trigger, template, resolver);

  // Determine final file path
  const finalUri = new URI({
    scheme: workspace.workspaceFolders[0].uri.scheme,
    path: result.filepath,
  });

  // Create the note using NoteFactory with the same resolver
  const createdNote = await NoteFactory.createNote(
    finalUri,
    result.content,
    resolver,
    args.onFileExists,
    args.onRelativeNotePath
  );

  // Handle source link updates for placeholders
  if (args.sourceLink && createdNote.uri) {
    const identifier = foam.workspace.getIdentifier(createdNote.uri);
    const edit = MarkdownLink.createUpdateLinkEdit(args.sourceLink.data, {
      target: identifier,
    });
    if (edit.newText !== args.sourceLink.data.rawText) {
      const updateLink = new WorkspaceEdit();
      const uri = toVsCodeUri(args.sourceLink.uri);
      updateLink.replace(
        uri,
        toVsCodeRange(args.sourceLink.range),
        edit.newText
      );
      await workspace.applyEdit(updateLink);
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
