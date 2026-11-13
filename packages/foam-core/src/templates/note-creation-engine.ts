import { Resolver } from './variable-resolver';
import { Foam } from '../model/foam';
import { URI } from '../model/uri';
import { Logger } from '../utils/log';
import {
  NoteCreationResult,
  NoteCreationTrigger,
  ProcessedTemplate,
  Template,
  TemplateContext,
  isCommandTrigger,
  isPlaceholderTrigger,
} from './note-creation-types';
import { extractFoamTemplateFrontmatterMetadata } from '../utils/template-frontmatter-parser';
/**
 * Characters that are invalid in file names
 * Based on UNALLOWED_CHARS from variable-resolver.ts but excluding filepaths
 * related chars and chars permissible in filepaths
 */
const FILEPATH_UNALLOWED_CHARS = '<>?*"|';

/**
 * Sanitizes a filepath by replacing invalid characters with dashes
 * @param filepath The filepath to sanitize
 * @returns The sanitized filepath
 */
function sanitizeFilepath(filepath: string): string {
  // Escape special regex characters and create character class
  const escapedChars = FILEPATH_UNALLOWED_CHARS.replace(/[\\^\-\]]/g, '\\$&');
  const regex = new RegExp(`[${escapedChars}]`, 'g');
  return filepath.replace(regex, '-');
}

export interface ProcessTemplateOptions {
  /**
   * Target for a markdown template that does not set a `filepath`. Used as
   * given — a relative URI stays relative — instead of deriving a name from
   * `FOAM_TITLE`, so the title is not requested when the target is already
   * known. JavaScript templates return their own filepath.
   */
  defaultFilepath?: URI;
  /**
   * Whether the client can open the note as an unsaved editor. When set, a
   * markdown template with no `filepath` and no `defaultFilepath` yields an
   * `UnsavedNoteResult` (#1243), suggesting a name only when a title is
   * already available (see `Resolver.isTitleAvailable`) — the title prompt
   * belongs to the template's content, not to its target. Clients without
   * the capability keep deriving a filename from the title.
   */
  canOpenUnsaved?: boolean;
}

/**
 * Unified engine for creating notes from both Markdown and JavaScript templates
 */
export class NoteCreationEngine {
  constructor(private foam: Foam) {}

  /**
   * Processes a template and generates note content and filepath
   * This method only handles template processing, not file creation
   *
   * @param trigger The trigger that initiated the note creation
   * @param template The template object containing content or function
   * @param resolver Resolver instance with all variables pre-configured
   * @param options See {@link ProcessTemplateOptions}
   * @returns Promise resolving to the generated content and filepath
   */
  async processTemplate(
    trigger: NoteCreationTrigger,
    template: Template,
    resolver: Resolver,
    options: ProcessTemplateOptions = {}
  ): Promise<ProcessedTemplate> {
    Logger.info(`Processing ${template.type} template`);
    this.logTriggerInfo(trigger);

    let result: ProcessedTemplate | null = null;
    switch (template.type) {
      case 'javascript':
        result = await this.executeJSTemplate(trigger, template, resolver);
        break;
      case 'markdown':
        result = await this.executeMarkdownTemplate(
          template,
          resolver,
          options
        );
        break;
      default:
        throw new Error(`Unsupported template type: ${(template as any).type}`);
    }

    return result;
  }

  /**
   * Executes a JavaScript template
   */
  private async executeJSTemplate(
    trigger: NoteCreationTrigger,
    template: Template & { type: 'javascript' },
    resolver: Resolver
  ): Promise<NoteCreationResult> {
    const templateContext: TemplateContext = {
      trigger,
      resolver,
      foam: this.foam,
      foamDate: resolver.foamDate,
    };

    try {
      const result = await template.createNote(templateContext);

      // Validate the result structure and types
      this.validateNoteCreationResult(result);

      if (!(result.filepath instanceof URI)) {
        const fp = result.filepath as string;
        const isAbsolutePath = fp.startsWith('/') || /^[a-zA-Z]:/.test(fp);
        result.filepath = isAbsolutePath
          ? this.foam.workspace.resolveNoteUri(fp)
          : new URI({ scheme: 'file', path: fp.replace(/\\/g, '/') });
      }
      // Foam variables in the returned content are resolved like in a
      // markdown template; other snippet syntax is left for the editor.
      result.content = await resolver.resolveText(result.content);
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      Logger.error(`JavaScript template execution failed: ${errorMessage}`);
      throw new Error(`JavaScript template execution failed: ${errorMessage}`);
    }
  }

  /**
   * Executes a Markdown template using variable resolution
   */
  private async executeMarkdownTemplate(
    template: Template & { type: 'markdown' },
    resolver: Resolver,
    options: ProcessTemplateOptions
  ): Promise<ProcessedTemplate> {
    // Use the provided resolver directly for variable resolution
    const resolvedContent = await resolver.resolveText(template.content);

    // Process frontmatter metadata
    const [frontmatterMetadata, cleanContent] =
      extractFoamTemplateFrontmatterMetadata(resolvedContent);

    // Combine template metadata with frontmatter metadata (frontmatter takes precedence)
    const metadata = new Map([
      ...(template.metadata ?? new Map()),
      ...frontmatterMetadata,
    ]);

    const templateFilepath = metadata.get('filepath');
    if (!templateFilepath && options.defaultFilepath) {
      return { filepath: options.defaultFilepath, content: cleanContent };
    }

    // The target is decided by `filepath` alone, the title prompt by the
    // content alone (#1243): without a `filepath` the note opens unsaved,
    // and a title, when the template uses one, only suggests its name.
    if (!templateFilepath && options.canOpenUnsaved) {
      return resolver.isTitleAvailable()
        ? {
            unsaved: true,
            content: cleanContent,
            suggestedFilepath: this.toTargetUri(
              await this.generateDefaultFilepath(resolver)
            ),
          }
        : { unsaved: true, content: cleanContent };
    }

    return {
      filepath: this.toTargetUri(
        templateFilepath ?? (await this.generateDefaultFilepath(resolver))
      ),
      content: cleanContent,
    };
  }

  /**
   * Turns a template filepath into a target URI: sanitized, absolute paths
   * resolved via the workspace (fixes #1537 path doubling), relative ones
   * left relative for the caller to resolve, with backslashes normalized to
   * forward slashes (mirrors fromFsPath).
   */
  private toTargetUri(rawFilepath: string): URI {
    const filepath = sanitizeFilepath(rawFilepath);
    const isAbsolutePath =
      filepath.startsWith('/') || /^[a-zA-Z]:/.test(filepath);
    return isAbsolutePath
      ? this.foam.workspace.resolveNoteUri(filepath)
      : new URI({ scheme: 'file', path: filepath.replace(/\\/g, '/') });
  }

  /**
   * Generates a default filepath when none is specified in the template
   */
  private async generateDefaultFilepath(resolver: Resolver): Promise<string> {
    const name =
      (await resolver.resolveFromName('FOAM_TITLE_SAFE')) || 'untitled';
    return `${name}.md`;
  }

  /**
   * Validates the result returned by a JavaScript template
   */
  private validateNoteCreationResult(
    result: any
  ): asserts result is NoteCreationResult {
    if (!result || typeof result !== 'object') {
      throw new Error('JavaScript template must return an object');
    }

    if (
      !Object.prototype.hasOwnProperty.call(result, 'filepath') ||
      (typeof result.filepath !== 'string' && !(result.filepath instanceof URI))
    ) {
      throw new Error(
        'JavaScript template result must have a "filepath" property of type string or URI'
      );
    }

    if (
      !Object.prototype.hasOwnProperty.call(result, 'content') ||
      typeof result.content !== 'string'
    ) {
      throw new Error(
        'JavaScript template result must have a "content" property of type string'
      );
    }

    // Optional: Validate filepath doesn't contain dangerous characters
    const invalidChars = /[<>:"|?*\x00-\x1F]/; // eslint-disable-line no-control-regex
    if (invalidChars.test(result.filepath.path)) {
      throw new Error(
        'JavaScript template result "filepath" contains invalid characters'
      );
    }
  }

  /**
   * Logs trigger-specific information for debugging
   */
  private logTriggerInfo(trigger: NoteCreationTrigger): void {
    if (isCommandTrigger(trigger)) {
      Logger.info(`Note creation triggered by command: ${trigger.command}`);
      if (trigger.params) {
        Logger.info(`Command params:`, trigger.params);
      }

      // Handle specific commands
      switch (trigger.command) {
        case 'foam-vscode.open-daily-note': {
          const date = trigger.params?.date;
          Logger.info(`Daily note for date: ${date}`);
          break;
        }
        case 'foam-vscode.create-note-from-template': {
          const templateUri = trigger.params?.templateUri;
          Logger.info(`Using template: ${templateUri}`);
          break;
        }
        default:
          Logger.info(`Generic command: ${trigger.command}`);
      }
    } else if (isPlaceholderTrigger(trigger)) {
      const sourceNote = trigger.sourceNote;
      Logger.info(`Creating note from placeholder in: ${sourceNote.title}`);
      Logger.info(`Source URI: ${sourceNote.uri}`);
    }
  }
}
