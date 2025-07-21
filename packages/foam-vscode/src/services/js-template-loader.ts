import * as vm from 'vm';
import { readFile } from './editor';
import { URI } from '../core/model/uri';
import { CreateNoteFunction, TemplateContext } from './note-creation-types';
import { createTemplateSandbox, BLOCKED_GLOBALS } from './js-template-sandbox';
import { Logger } from '../core/utils/log';

/**
 * Error thrown when there are issues loading or executing JavaScript templates
 */
export class JSTemplateError extends Error {
  constructor(message: string, public readonly templatePath: string) {
    super(`JavaScript template error in ${templatePath}: ${message}`);
    this.name = 'JSTemplateError';
  }
}

/**
 * Loader for JavaScript template functions with secure VM execution
 */
export class JSTemplateLoader {
  private static readonly EXECUTION_TIMEOUT = 10000; // 10 seconds
  private static readonly VM_OPTIONS: vm.RunningScriptOptions = {
    timeout: JSTemplateLoader.EXECUTION_TIMEOUT,
    displayErrors: true,
  };

  /**
   * Loads and returns a note creation function from a JavaScript template file
   *
   * @param templatePath Path to the JavaScript template file
   * @returns The createNote function from the template
   */
  async loadFunction(templatePath: string): Promise<CreateNoteFunction> {
    try {
      Logger.info(`Loading JavaScript template: ${templatePath}`);

      const templateUri = URI.parse(templatePath);
      const templateCode = await readFile(templateUri);

      if (!templateCode) {
        throw new JSTemplateError(
          `Template file not found or empty`,
          templatePath
        );
      }

      return this.createFunctionFromCode(templateCode, templatePath);
    } catch (error) {
      if (error instanceof JSTemplateError) {
        throw error;
      }
      throw new JSTemplateError(
        `Failed to load template: ${error.message}`,
        templatePath
      );
    }
  }

  /**
   * Creates a note creation function from JavaScript code
   *
   * @param code The JavaScript code containing the createNote function
   * @param templatePath Path for error reporting
   * @returns The createNote function
   */
  private createFunctionFromCode(
    code: string,
    templatePath: string
  ): CreateNoteFunction {
    try {
      // Validate the code structure
      this.validateTemplateCode(code, templatePath);

      // Create the VM context with sandbox
      const sandbox = this.createVMSandbox();
      const context = vm.createContext(sandbox);

      // Execute the template code in the sandbox
      const script = new vm.Script(code, {
        filename: templatePath,
        lineOffset: 0,
        columnOffset: 0,
      });

      script.runInContext(context, JSTemplateLoader.VM_OPTIONS);

      // Extract the createNote function
      const createNote = context.createNote;
      if (typeof createNote !== 'function') {
        throw new JSTemplateError(
          'Template must declare a createNote function',
          templatePath
        );
      }

      // Wrap the function to inject the sandbox context
      return async (noteContext: TemplateContext) => {
        try {
          // Update the sandbox with the current context
          const contextSandbox = createTemplateSandbox(noteContext);
          Object.assign(context, contextSandbox);

          // Execute the template function
          const result = await createNote(noteContext);

          // Validate the result
          this.validateResult(result, templatePath);

          return result;
        } catch (error) {
          if (error instanceof JSTemplateError) {
            throw error;
          }
          throw new JSTemplateError(
            `Template execution failed: ${error.message}`,
            templatePath
          );
        }
      };
    } catch (error) {
      if (error instanceof JSTemplateError) {
        throw error;
      }
      throw new JSTemplateError(
        `Failed to create function: ${error.message}`,
        templatePath
      );
    }
  }

  /**
   * Creates a secure VM sandbox with limited globals
   */
  private createVMSandbox() {
    const sandbox: Record<string, any> = {};

    // Block dangerous globals
    BLOCKED_GLOBALS.forEach(globalName => {
      sandbox[globalName] = undefined;
    });

    return sandbox;
  }

  /**
   * Validates that the template code has the expected structure
   */
  private validateTemplateCode(code: string, templatePath: string): void {
    // Check for createNote function
    if (
      !code.includes('function createNote') &&
      !code.includes('createNote =')
    ) {
      throw new JSTemplateError(
        'Template must define a createNote function',
        templatePath
      );
    }

    // Check for potentially dangerous patterns
    const dangerousPatterns = [
      /require\s*\(/,
      /import\s+/,
      /eval\s*\(/,
      /Function\s*\(/,
      /process\./,
      /__dirname/,
      /__filename/,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        throw new JSTemplateError(
          `Template contains potentially unsafe code: ${pattern.source}`,
          templatePath
        );
      }
    }
  }

  /**
   * Validates the result returned by a template function
   */
  private validateResult(result: any, templatePath: string): void {
    if (!result || typeof result !== 'object') {
      throw new JSTemplateError(
        'Template must return an object with filepath and content properties',
        templatePath
      );
    }

    if (typeof result.filepath !== 'string' || !result.filepath.trim()) {
      throw new JSTemplateError(
        'Template result must have a non-empty filepath string',
        templatePath
      );
    }

    if (typeof result.content !== 'string') {
      throw new JSTemplateError(
        'Template result must have a content string',
        templatePath
      );
    }
  }
}
