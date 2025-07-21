import { TemplateContext } from './note-creation-types';
import { URI } from '../core/model/uri';
import { toSlug } from '../utils/slug';
import { Logger } from '../core/utils/log';
import dayjs from 'dayjs';

/**
 * Creates a sandbox environment for JavaScript template execution
 * This provides utility functions and safe globals for template functions
 */
export function createTemplateSandbox(context: TemplateContext) {
  return {
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

    // Console for debugging (logs to Foam output channel)
    console: {
      log: (...args: any[]) =>
        Logger.info(`[Template] ${args[0]}`, ...args.slice(1)),
      warn: (...args: any[]) =>
        Logger.warn(`[Template] ${args[0]}`, ...args.slice(1)),
      error: (...args: any[]) =>
        Logger.error(`[Template] ${args[0]}`, ...args.slice(1)),
    },

    // Utility functions
    dayjs,
    slugify: toSlug,
    URI,
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
