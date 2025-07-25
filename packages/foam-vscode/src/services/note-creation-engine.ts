import { Resolver } from './variable-resolver';
import { Foam } from '../core/model/foam';
import { Logger } from '../core/utils/log';
import {
  NoteCreationResult,
  NoteCreationTrigger,
  Template,
  TemplateContext,
  isCommandTrigger,
  isPlaceholderTrigger,
} from './note-creation-types';
import { extractFoamTemplateFrontmatterMetadata } from '../utils/template-frontmatter-parser';
import { asAbsoluteUri, URI } from '../core/model/uri';
import { isAbsolute } from 'path';

/**
 * Unified engine for creating notes from both Markdown and JavaScript templates
 */
export class NoteCreationEngine {
  constructor(private foam: Foam, private roots: URI[]) {}

  /**
   * Processes a template and generates note content and filepath
   * This method only handles template processing, not file creation
   *
   * @param trigger The trigger that initiated the note creation
   * @param template The template object containing content or function
   * @param resolver Resolver instance with all variables pre-configured
   * @returns Promise resolving to the generated content and filepath
   */
  async processTemplate(
    trigger: NoteCreationTrigger,
    template: Template,
    resolver: Resolver
  ): Promise<NoteCreationResult> {
    Logger.info(`Processing ${template.type} template`);
    this.logTriggerInfo(trigger);

    let result: NoteCreationResult | null = null;
    if (template.type === 'javascript') {
      result = await this.executeJSTemplate(trigger, template, resolver);
    } else {
      result = await this.executeMarkdownTemplate(trigger, template, resolver);
    }

    return {
      ...result,
      filepath: result.filepath,
    };
  }

  /**
   * Executes a JavaScript template
   */
  private async executeJSTemplate(
    trigger: NoteCreationTrigger,
    template: Template & { type: 'javascript' },
    resolver: Resolver
  ): Promise<NoteCreationResult> {
    // Convert resolver's variables back to extraParams for backward compatibility
    const extraParams = resolver.getVariables();

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
        result.filepath = URI.parse(result.filepath);
      }
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
    trigger: NoteCreationTrigger,
    template: Template & { type: 'markdown' },
    resolver: Resolver
  ): Promise<NoteCreationResult> {
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

    // Determine filepath - get variables from resolver for default generation
    const filepath =
      metadata.get('filepath') ??
      (await this.generateDefaultFilepath(resolver));

    return {
      filepath: URI.parse(filepath),
      content: cleanContent,
    };
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
