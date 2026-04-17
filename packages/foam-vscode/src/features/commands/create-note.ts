import { workspace, commands, WorkspaceEdit, ExtensionContext } from 'vscode';
import { URI } from '../../core/model/uri';
import {
  askUserForTemplate,
  getDefaultTemplateUri,
} from '../../vscode/services/template-service';
import { NoteFactory } from '../../vscode/services/note-factory';
import { NoteCreationEngine } from '../../core/templates/note-creation-engine';
import { TriggerFactory } from '../../core/templates/note-creation-triggers';
import { TemplateLoader } from '../../core/templates/template-loader';
import { Template } from '../../core/templates/note-creation-types';
import { Resolver } from '../../core/templates/variable-resolver';
import { VsCodeVariableProvider } from '../../vscode/services/vscode-variable-provider';
import {
  asAbsoluteWorkspaceUri,
  fileExists,
  readFile,
} from '../../services/editor';
import { getFoamVsCodeConfig } from '../../vscode/config';
import { CommandDescriptor } from '../../utils/commands';
import { Foam } from '../../core/model/foam';
import { Location } from '../../core/model/location';
import { MarkdownLink } from '../../core/services/markdown-link';
import { ResourceLink } from '../../core/model/note';
import { toVsCodeRange, toVsCodeUri } from '../../utils/vsc-utils';
import { Logger } from '../../core/utils/log';

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
  notePath?: string | URI;
  /**
   * The path of the template to use.
   */
  templatePath?: string | URI;
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
  date?: string | Date;
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

/**
 * Related to #1505.
 * This function forces the date to be local by removing any time information and
 * adding a local time (noon) to it.
 * @param dateString The date string, either in YYYY-MM-DD format or any format parsable by Date()
 * @returns The parsed Date object
 */
function forceLocalDate(dateString: string): Date {
  // Remove the time part if present
  const dateOnly = dateString.split('T')[0];
  // Otherwise, treat as local date by adding local noon time
  return new Date(dateOnly + 'T12:00:00');
}

export async function createNote(args: CreateNoteArgs, foam: Foam) {
  args = args ?? {};
  const foamDate =
    typeof args.date === 'string'
      ? forceLocalDate(args.date)
      : args.date instanceof Date
      ? args.date
      : new Date();

  // Create appropriate trigger based on context
  const trigger = args.sourceLink
    ? TriggerFactory.createPlaceholderTrigger(
        args.sourceLink.uri,
        foam.workspace.find(new URI(args.sourceLink.uri))?.title || 'Unknown',
        args.sourceLink
      )
    : TriggerFactory.createCommandTrigger('foam-vscode.create-note');

  // Determine template path
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
      : await getDefaultTemplateUri();
  }

  // Load template using the new system
  const templateLoader = new TemplateLoader(readFile, workspace.isTrusted);
  let template: Template;

  try {
    if (!templateUri) {
      template = {
        type: 'markdown',
        metadata: new Map(),
        content: args.text || DEFAULT_NEW_NOTE_TEXT,
      };
    } else if (await fileExists(templateUri)) {
      template = await templateLoader.loadTemplate(templateUri);
    } else {
      throw new Error(`Template file not found: ${templateUri}`);
    }
  } catch (error) {
    throw new Error(
      `Failed to load template (${templateUri}): ${error.message}`
    );
  }

  // If notePath is provided, add it to template metadata to avoid unnecessary title resolution
  if (args.notePath && template.type === 'markdown') {
    template.metadata.set(
      'filepath',
      typeof args.notePath === 'string'
        ? args.notePath
        : args.notePath.toFsPath()
    );
  }

  // Create resolver with all variables upfront
  const locale = getFoamVsCodeConfig<string>('dateLocale', 'default');
  const resolver = new Resolver(
    new Map(Object.entries(args.variables ?? {})),
    foamDate,
    args.title,
    locale,
    new VsCodeVariableProvider()
  );

  if (Logger.getLevel() === 'debug') {
    Logger.debug(`[createNote] args: ${JSON.stringify(args, null, 2)}`);
    Logger.debug(`[createNote] template: ${JSON.stringify(template, null, 2)}`);
    Logger.debug(`[createNote] resolver: ${JSON.stringify(resolver, null, 2)}`);
    Logger.debug(
      `[createNote] foamDate: ${foamDate.toISOString()} (timezone offset: ${foamDate.getTimezoneOffset()})`
    );
  }

  // Process template using the new engine with unified resolver
  const engine = new NoteCreationEngine(foam);
  const result = await engine.processTemplate(trigger, template, resolver);

  // Create the note using NoteFactory with the same resolver
  const createdNote = await NoteFactory.createNote(
    result.filepath,
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
