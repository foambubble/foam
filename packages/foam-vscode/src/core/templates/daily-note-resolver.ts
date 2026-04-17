import { URI } from '../model/uri';
import { Foam } from '../model/foam';
import { TemplateLoader } from './template-loader';
import { NoteCreationEngine } from './note-creation-engine';
import { TriggerFactory } from './note-creation-triggers';
import { Resolver } from './variable-resolver';
import { NoteCreationResult } from './note-creation-types';

export interface ResolveDailyNoteOptions {
  locale?: string;
  isTrusted?: boolean;
  /**
   * Filepath to use if the template does not specify one.
   * Prevents interactive title prompts when a known output path already exists.
   */
  fallbackFilepath?: URI;
  /**
   * Pre-defined variable values to inject into the resolver (e.g. FOAM_TITLE).
   */
  variables?: Map<string, string>;
}

/**
 * Resolves the daily note content and filepath for a given date.
 * No VS Code dependency — suitable for CLI and other non-VS Code contexts.
 *
 * @param date The date for the daily note
 * @param templateUri The resolved URI of the daily note template
 * @param foam The Foam workspace instance
 * @param readFile Function to read file contents by URI
 * @param options Optional locale and trust flag
 * @returns The resolved filepath and content for the daily note
 */
export async function resolveDailyNote(
  date: Date,
  templateUri: URI,
  foam: Foam,
  readFile: (uri: URI) => Promise<string>,
  options: ResolveDailyNoteOptions = {}
): Promise<NoteCreationResult> {
  const { locale = 'default', isTrusted = false, fallbackFilepath, variables } = options;

  const templateLoader = new TemplateLoader(readFile, isTrusted);
  const resolver = new Resolver(variables ?? new Map(), date, undefined, locale);
  const trigger = TriggerFactory.createCommandTrigger('foam.open-daily-note');
  const engine = new NoteCreationEngine(foam);

  const template = await templateLoader.loadTemplate(templateUri);

  // If a fallback filepath is provided and the template doesn't define one,
  // inject it so we don't fall through to interactive title resolution.
  if (
    fallbackFilepath &&
    template.type === 'markdown' &&
    !template.metadata.get('filepath')
  ) {
    template.metadata.set('filepath', fallbackFilepath.toFsPath());
  }

  return engine.processTemplate(trigger, template, resolver);
}
