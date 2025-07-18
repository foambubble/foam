import { TemplateContext } from './note-creation-types';
import { URI } from '../core/model/uri';
import { toSlug } from '../utils/slug';
import dateFormat from 'dateformat';
import { Logger } from '../core/utils/log';

/**
 * Creates a sandbox environment for JavaScript template execution
 * This provides utility functions and safe globals for template functions
 */
export function createTemplateSandbox(context: TemplateContext) {
  return {
    // Utility functions
    dateFormat,
    slugify: toSlug,
    URI,

    // Safe console for debugging (logs to Foam output channel)
    console: {
      log: (...args: any[]) => Logger.info('[Template]', ...args),
      warn: (...args: any[]) => Logger.warn('[Template]', ...args),
      error: (...args: any[]) => Logger.error('[Template]', ...args),
    },

    // Common JavaScript globals (safe subset)
    Date,
    Math,
    Object,
    Array,
    String,
    Number,
    Boolean,
    JSON,
    RegExp,
    Error,

    // Utility error classes
    TemplateError: class TemplateError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'TemplateError';
      }
    },
  };
}

/**
 * List of globals that should NOT be available in the template sandbox
 * for security reasons
 */
export const BLOCKED_GLOBALS = [
  'require',
  'module',
  'exports',
  '__dirname',
  '__filename',
  'global',
  'process',
  'Buffer',
  'setImmediate',
  'clearImmediate',
  'setInterval',
  'clearInterval',
  'setTimeout',
  'clearTimeout',
  'eval',
  'Function',
];
