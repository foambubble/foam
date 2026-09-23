import { URI } from '../model/uri';
import { Foam } from '../model/foam';
import { TemplateLoader } from './template-loader';
import { NoteCreationEngine } from './note-creation-engine';
import { TriggerFactory } from './note-creation-triggers';
import { Resolver } from './variable-resolver';
import { NoteCreationResult } from './note-creation-types';
import { partsFromTemplateFilepath } from './daily-note-path-pattern';
import { findPreviousDailyNote } from './previous-daily-note';

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
  // The template is loaded before the resolver because FOAM_PREVIOUS_DAILY_NOTE
  // recognizes daily notes by inverting the template's `filepath`. A template
  // without one leaves the variable unresolved: the fallback path belongs to
  // the host (`foam daily`, VS Code settings), not to core.
  const template = await templateLoader.loadTemplate(templateUri);
  const templateFilepath =
    template.type === 'markdown'
      ? template.metadata.get('filepath')
      : undefined;
  const pathPattern = templateFilepath
    ? partsFromTemplateFilepath(templateFilepath)
    : undefined;

  const resolver = new Resolver(
    variables ?? new Map(),
    date,
    undefined,
    locale,
    undefined,
    before => {
      const uri = findPreviousDailyNote(foam.workspace, pathPattern, before);
      return uri && foam.workspace.getIdentifier(uri);
    }
  );
  const trigger = TriggerFactory.createCommandTrigger('foam.open-daily-note');
  const engine = new NoteCreationEngine(foam);

  return engine.processTemplate(trigger, template, resolver, {
    defaultFilepath: fallbackFilepath,
  });
}
