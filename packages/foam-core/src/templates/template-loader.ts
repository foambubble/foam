import { FoamError } from '../common/errors';
import { URI } from '../model/uri';
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

  constructor(
    private readonly readFile: (uri: URI) => Promise<string>,
    private readonly isTrusted: boolean
  ) {
    this.jsTemplateLoader = new JSTemplateLoader(readFile);
  }

  /**
   * Loads a template from a file path
   * @param template Path to the template file (relative or absolute)
   * @returns Promise resolving to a Template object
   */
  async loadTemplate(template: URI): Promise<Template> {
    if (template.path.endsWith('.js')) {
      if (!this.isTrusted) {
        throw new FoamError(
          'untrusted_workspace',
          `JavaScript template ${template.path} was not executed: the workspace is not trusted. JS templates can run arbitrary code, so they only execute in trusted workspaces.`,
          { templatePath: template.path }
        );
      }
      return await this.loadJavaScriptTemplate(template);
    } else {
      return await this.loadMarkdownTemplate(template);
    }
  }

  /**
   * Loads a JavaScript template
   */
  private async loadJavaScriptTemplate(template: URI): Promise<Template> {
    const createNoteFunction = await this.jsTemplateLoader.loadFunction(
      template
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
  private async loadMarkdownTemplate(template: URI): Promise<Template> {
    const content = await this.readFile(template);

    // Extract metadata from frontmatter if present
    const [metadata] = extractFoamTemplateFrontmatterMetadata(content);

    return {
      type: 'markdown',
      content,
      metadata,
    };
  }
}
