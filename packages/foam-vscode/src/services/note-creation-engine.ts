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

    if (template.type === 'javascript') {
      return await this.executeJSTemplate(trigger, template, resolver);
    } else {
      return await this.executeMarkdownTemplate(trigger, template, resolver);
    }
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
      filepath,
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
