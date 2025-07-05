import { URI } from '../core/model/uri';
import { Resolver } from './variable-resolver';
import { NoteFactory, getTemplateInfo } from './templates';
import { asAbsoluteWorkspaceUri } from './editor';
import { Foam } from '../core/model/foam';
import { Logger } from '../core/utils/log';
import {
  NoteCreationContext,
  NoteCreationResult,
  isCommandTrigger,
  isPlaceholderTrigger,
} from './note-creation-types';
import { JSTemplateLoader, JSTemplateError } from './js-template-loader';

/**
 * Unified engine for creating notes from both Markdown and JavaScript templates
 */
export class NoteCreationEngine {
  private jsTemplateLoader: JSTemplateLoader;

  constructor(private foam: Foam) {
    this.jsTemplateLoader = new JSTemplateLoader();
  }

  /**
   * Processes a template and generates note content and filepath
   * This method only handles template processing, not file creation
   *
   * @param context The note creation context
   * @returns Promise resolving to the generated content and filepath
   */
  async processTemplate(context: NoteCreationContext): Promise<NoteCreationResult> {
    try {
      Logger.info(`Processing template: ${context.template}`);
      this.logTriggerInfo(context);

      // Add template expansion function to context
      const contextWithExpansion: NoteCreationContext = {
        ...context,
        expandTemplate: this.createTemplateExpander(context),
      };

      if (context.template.endsWith('.js')) {
        return await this.executeJSTemplate(contextWithExpansion);
      } else {
        return await this.executeMarkdownTemplate(contextWithExpansion);
      }
    } catch (error) {
      Logger.error('Template processing failed', error);

      if (error instanceof JSTemplateError) {
        throw error;
      }

      throw new Error(`Template processing failed: ${error.message}`);
    }
  }

  /**
   * Creates a note using the unified creation system
   * This method combines template processing with file creation
   *
   * @param context The note creation context
   * @returns Promise resolving to creation result with URI and success status
   */
  async createNote(
    context: NoteCreationContext
  ): Promise<{ didCreateFile: boolean; uri: URI }> {
    // Process the template to get content and filepath
    const result = await this.processTemplate(context);

    // Convert result to absolute URI and create the note
    const uri = this.resolveResultUri(result.filepath);
    const resolver = new Resolver(new Map(), new Date());

    return await NoteFactory.createNote(uri, result.content, resolver);
  }

  /**
   * Creates the template expansion utility function for the context
   */
  private createTemplateExpander(context: NoteCreationContext) {
    return async (templatePath: string, variables?: Record<string, string>) => {
      const resolver = new Resolver(new Map(), new Date());

      // Add context extraParams as variables
      Object.entries(context.extraParams).forEach(([key, value]) => {
        resolver.define(key, String(value));
      });

      // Add any additional variables passed to expandTemplate
      if (variables) {
        Object.entries(variables).forEach(([key, value]) => {
          resolver.define(key, value);
        });
      }

      const templateUri = asAbsoluteWorkspaceUri(templatePath);
      const templateInfo = await getTemplateInfo(templateUri, '', resolver);

      return {
        content: templateInfo.text,
        metadata: templateInfo.metadata,
      };
    };
  }

  /**
   * Executes a JavaScript template
   */
  private async executeJSTemplate(
    context: NoteCreationContext
  ): Promise<NoteCreationResult> {
    const createNoteFunction = await this.jsTemplateLoader.loadFunction(
      context.template
    );
    return await createNoteFunction(context);
  }

  /**
   * Executes a Markdown template using the existing template system
   */
  private async executeMarkdownTemplate(
    context: NoteCreationContext
  ): Promise<NoteCreationResult> {
    const expanded = await context.expandTemplate(context.template);

    const filepath =
      expanded.metadata.get('filepath') ||
      (await this.generateDefaultFilepath(context));

    return {
      filepath,
      content: expanded.content,
    };
  }

  /**
   * Resolves a filepath result to an absolute URI
   */
  private resolveResultUri(filepath: string): URI {
    if (URI.parse(filepath).isAbsolute()) {
      return URI.parse(filepath);
    }
    return asAbsoluteWorkspaceUri(filepath);
  }

  /**
   * Generates a default filepath when none is specified in the template
   */
  private async generateDefaultFilepath(
    context: NoteCreationContext
  ): Promise<string> {
    // Use FOAM_TITLE if available, otherwise use a default name
    const title = context.extraParams.title || 'untitled';
    const resolver = new Resolver(new Map([['FOAM_TITLE', title]]), new Date());

    const titleSafe = await resolver.resolveFromName('FOAM_TITLE_SAFE');
    return `${titleSafe}.md`;
  }

  /**
   * Logs trigger-specific information for debugging
   */
  private logTriggerInfo(context: NoteCreationContext): void {
    if (isCommandTrigger(context.trigger)) {
      Logger.info(
        `Note creation triggered by command: ${context.trigger.command}`
      );
      if (context.trigger.params) {
        Logger.info(`Command params:`, context.trigger.params);
      }

      // Handle specific commands
      switch (context.trigger.command) {
        case 'foam-vscode.open-daily-note': {
          const date = context.trigger.params?.date;
          Logger.info(`Daily note for date: ${date}`);
          break;
        }
        case 'foam-vscode.create-note-from-template': {
          const templateUri = context.trigger.params?.templateUri;
          Logger.info(`Using template: ${templateUri}`);
          break;
        }
        default:
          Logger.info(`Generic command: ${context.trigger.command}`);
      }
    } else if (isPlaceholderTrigger(context.trigger)) {
      const sourceNote = context.trigger.sourceNote;
      Logger.info(`Creating note from placeholder in: ${sourceNote.title}`);
      Logger.info(`Source URI: ${sourceNote.uri}`);
    }
  }
}
