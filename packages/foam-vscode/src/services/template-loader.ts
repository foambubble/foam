import { workspace } from 'vscode';
import { URI } from '../core/model/uri';
import { readFile } from './editor';
import {
  Template,
  TemplateContext,
  NoteCreationResult,
} from './note-creation-types';
import { extractFoamTemplateFrontmatterMetadata } from '../utils/template-frontmatter-parser';
import { JSTemplateLoader } from './js-template-loader';

/**
 * Utility for loading templates from file paths and converting them to Template objects
 */
export class TemplateLoader {
  private jsTemplateLoader: JSTemplateLoader;

  constructor() {
    this.jsTemplateLoader = new JSTemplateLoader();
  }

  /**
   * Loads a template from a file path
   * @param templatePath Path to the template file (relative or absolute)
   * @returns Promise resolving to a Template object
   */
  async loadTemplate(templatePath: string): Promise<Template> {
    if (templatePath.endsWith('.js')) {
      if (!workspace.isTrusted) {
        throw new Error(
          'JavaScript templates can only be used in trusted workspaces for security reasons'
        );
      }
      return await this.loadJavaScriptTemplate(templatePath);
    } else {
      return await this.loadMarkdownTemplate(templatePath);
    }
  }

  /**
   * Loads a JavaScript template
   */
  private async loadJavaScriptTemplate(
    templatePath: string
  ): Promise<Template> {
    const createNoteFunction = await this.jsTemplateLoader.loadFunction(
      templatePath
    );

    // Ensure the function returns a Promise
    const createNote = async (
      context: TemplateContext
    ): Promise<NoteCreationResult> => {
      const result = await createNoteFunction(context);
      return result;
    };

    return {
      type: 'javascript',
      createNote,
    };
  }

  /**
   * Loads a Markdown template
   */
  private async loadMarkdownTemplate(templatePath: string): Promise<Template> {
    // Read the template file content
    const templateUri =
      typeof templatePath === 'string' ? URI.parse(templatePath) : templatePath;

    const content = await readFile(templateUri);

    // Extract metadata from frontmatter if present
    const [metadata] = extractFoamTemplateFrontmatterMetadata(content);

    return {
      type: 'markdown',
      content,
      metadata: metadata.size > 0 ? metadata : undefined,
    };
  }
}
