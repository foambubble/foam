import { URI } from '../core/model/uri';
import { Resolver } from './variable-resolver';
import { NoteFactory } from './templates';
import { asAbsoluteWorkspaceUri } from './editor';
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
   * @param extraParams Additional parameters for template processing
   * @returns Promise resolving to the generated content and filepath
   */
  async processTemplate(
    trigger: NoteCreationTrigger,
    template: Template,
    extraParams: Record<string, any>
  ): Promise<NoteCreationResult> {
    try {
      Logger.info(`Processing ${template.type} template`);
      this.logTriggerInfo(trigger);

      if (template.type === 'javascript') {
        return await this.executeJSTemplate(trigger, template, extraParams);
      } else {
        return await this.executeMarkdownTemplate(
          trigger,
          template,
          extraParams
        );
      }
    } catch (error) {
      Logger.error('Template processing failed', error);
      throw new Error(`Template processing failed: ${error.message}`);
    }
  }

  /**
   * Executes a JavaScript template
   */
  private async executeJSTemplate(
    trigger: NoteCreationTrigger,
    template: Template & { type: 'javascript' },
    extraParams: Record<string, any>
  ): Promise<NoteCreationResult> {
    const templateContext: TemplateContext = {
      trigger,
      extraParams,
      foam: this.foam,
    };

    return await template.createNote(templateContext);
  }

  /**
   * Executes a Markdown template using variable resolution
   */
  private async executeMarkdownTemplate(
    trigger: NoteCreationTrigger,
    template: Template & { type: 'markdown' },
    extraParams: Record<string, any>
  ): Promise<NoteCreationResult> {
    // Create resolver with extraParams
    const resolver = new Resolver(new Map(), new Date());
    Object.entries(extraParams).forEach(([key, value]) => {
      // Map common parameter names to Foam variable names
      const foamVariableName = key === 'title' ? 'FOAM_TITLE' : key;
      resolver.define(foamVariableName, String(value));
    });

    // Resolve variables in template content
    const resolvedContent = await resolver.resolveText(template.content);

    // Process frontmatter metadata
    const [frontmatterMetadata, cleanContent] =
      extractFoamTemplateFrontmatterMetadata(resolvedContent);

    // Combine template metadata with frontmatter metadata (frontmatter takes precedence)
    const metadata = new Map([
      ...(template.metadata || []),
      ...frontmatterMetadata,
    ]);

    // Determine filepath
    const filepath =
      metadata.get('filepath') || this.generateDefaultFilepath(extraParams);

    return {
      filepath,
      content: cleanContent,
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
  private generateDefaultFilepath(extraParams: Record<string, any>): string {
    // Use title from extraParams if available, otherwise use a default name
    const title = extraParams.title || 'untitled';
    // Simple safe filename generation (replace unsafe characters)
    const safeName = title
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return `${safeName}.md`;
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
