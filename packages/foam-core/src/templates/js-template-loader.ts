import * as vm from 'vm';
import { URI } from '../model/uri';
import { CreateNoteFunction, TemplateContext } from './note-creation-types';
import { createTemplateGlobals } from './js-template-sandbox';
import { Logger } from '../utils/log';

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
 * Loader for JavaScript template functions.
 *
 * Execution uses Node's `vm` module. This is NOT a security sandbox — `vm` is
 * not a security boundary, but provides a clean global namespace and 
 * a wall-clock execution timeout that interrupts an accidental infinite loop. 
 */
export class JSTemplateLoader {
  private static readonly EXECUTION_TIMEOUT = 10000; // 10 seconds
  private static readonly VM_OPTIONS: vm.RunningScriptOptions = {
    timeout: JSTemplateLoader.EXECUTION_TIMEOUT,
    displayErrors: true,
  };

  constructor(
    private readonly readFile: (uri: URI) => Promise<string>
  ) {}

  /**
   * Loads and returns a note creation function from a JavaScript template file
   *
   * @param template Path to the JavaScript template file
   * @returns The createNote function from the template
   */
  async loadFunction(template: URI): Promise<CreateNoteFunction> {
    try {
      Logger.info(`Loading JavaScript template: ${template.path}`);

      const templateCode = await this.readFile(template);

      if (!templateCode) {
        throw new JSTemplateError(
          `Template file not found or empty`,
          template.path
        );
      }

      return this.createFunctionFromCode(templateCode, template);
    } catch (error) {
      if (error instanceof JSTemplateError) {
        throw error;
      }
      throw new JSTemplateError(
        `Failed to load template: ${error.message}`,
        template.path
      );
    }
  }

  /**
   * Creates a note creation function from JavaScript code
   * SECURITY: This is not a sandbox; this runs with full RCE potential and
   * should only be called behind a trust gate (e.g. VS Code Workspace Trust).
   * 
   * @param code The JavaScript code containing the createNote function
   * @param template Path for error reporting
   * @returns The createNote function
   */
  private createFunctionFromCode(
    code: string,
    template: URI
  ): CreateNoteFunction {
    try {
      // Validate the code structure
      this.validateTemplateCode(code, template);

      const context = vm.createContext({});

      // Execute the template's top-level code to define `createNote`.
      const script = new vm.Script(code, {
        filename: template.toFsPath(),
        lineOffset: 0,
        columnOffset: 0,
      });

      script.runInContext(context, JSTemplateLoader.VM_OPTIONS);

      // Extract the createNote function
      const createNote = context.createNote;
      if (typeof createNote !== 'function') {
        throw new JSTemplateError(
          'Template must declare a createNote function',
          template.path
        );
      }

      // Wrap the function so each invocation refreshes the injected globals
      // with the current note context.
      return async (noteContext: TemplateContext) => {
        try {
          Object.assign(context, createTemplateGlobals(noteContext));

          // Execute the template function
          const result = await createNote(noteContext);

          // Validate the result
          this.validateResult(result, template);

          return result;
        } catch (error) {
          if (error instanceof JSTemplateError) {
            throw error;
          }
          throw new JSTemplateError(
            `Template execution failed: ${error.message}`,
            template.path
          );
        }
      };
    } catch (error) {
      if (error instanceof JSTemplateError) {
        throw error;
      }
      throw new JSTemplateError(
        `Failed to create function: ${error.message}`,
        template.path
      );
    }
  }

  /**
   * Checks that the template source defines a `createNote` function, so a
   * common authoring mistake fails with a clear message before the code runs.
   * This is a structural sanity check, not a security control.
   */
  private validateTemplateCode(code: string, template: URI): void {
    if (
      !code.includes('function createNote') &&
      !code.includes('createNote =')
    ) {
      throw new JSTemplateError(
        'Template must define a createNote function',
        template.path
      );
    }
  }

  /**
   * Validates the result returned by a template function
   */
  private validateResult(result: any, template: URI): void {
    if (!result || typeof result !== 'object') {
      throw new JSTemplateError(
        'Template must return an object with filepath and content properties',
        template.path
      );
    }

    if (typeof result.filepath !== 'string' || !result.filepath.trim()) {
      throw new JSTemplateError(
        'Template result must have a non-empty filepath string',
        template.path
      );
    }

    if (typeof result.content !== 'string') {
      throw new JSTemplateError(
        'Template result must have a content string',
        template.path
      );
    }
  }
}
