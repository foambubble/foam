import { TemplateContext } from './note-creation-types';
import { URI } from '../model/uri';
import { toSlug } from '../utils/slug';
import { Logger } from '../utils/log';
import dayjs from 'dayjs';

/**
 * Builds the globals and helpers exposed to a JavaScript template — the
 * template-facing API surface (date/string utilities, a logging console, the
 * `URI` type, etc.).
 *
 * This is NOT a security sandbox. 
 */
export function createTemplateGlobals(context: TemplateContext) {
  return {
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
