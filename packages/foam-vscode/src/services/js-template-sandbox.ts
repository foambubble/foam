import { TemplateContext } from './note-creation-types';
import { URI } from '../core/model/uri';
import { toSlug } from '../utils/slug';
import dateFormat from 'dateformat';

/**
 * Creates a sandbox environment for JavaScript template execution
 * This provides utility functions and safe globals for template functions
 */
export function createTemplateSandbox(context: TemplateContext) {
  return {
    // Context objects
    context,
    trigger: context.trigger,
    foam: context.foam,
    extraParams: context.extraParams,

    // Utility functions
    formatDate: dateFormat,
    slugify: toSlug,
    URI,

    // Date and time utilities
    getWeekNumber: (date: Date): number => {
      // ISO week number calculation
      const d = new Date(date);
      d.setDate(d.getDate() + 4 - (d.getDay() || 7));
      const thursday = d.getTime();

      d.setMonth(0); // January
      d.setDate(1); // 1st
      const janFirst = d.getTime();

      const days = Math.round((thursday - janFirst) / 86400000);
      return Math.floor(days / 7) + 1;
    },

    getSeason: (date: Date): string => {
      const month = date.getMonth();
      if (month < 2 || month === 11) return 'Winter';
      if (month < 5) return 'Spring';
      if (month < 8) return 'Summer';
      return 'Fall';
    },

    getWeekday: (date: Date): string => {
      return date.toLocaleDateString('en-US', { weekday: 'long' });
    },

    getWeekdayShort: (date: Date): string => {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    },

    // Safe console for debugging (logs to Foam output channel)
    console: {
      log: (...args: any[]) => console.log('[Template]', ...args),
      warn: (...args: any[]) => console.warn('[Template]', ...args),
      error: (...args: any[]) => console.error('[Template]', ...args),
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
