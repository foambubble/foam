import { Location } from '../model/location';
import { ResourceLink } from '../model/note';
import { Foam } from '../model/foam';
import { Resolver } from './variable-resolver';
import { URI } from '../model/uri';

/**
 * Union type for different trigger scenarios that can initiate note creation
 */
export type NoteCreationTrigger =
  | {
      type: 'command';
      command: string;
      params?: Record<string, any>; // Command arguments/parameters
    }
  | {
      type: 'placeholder';
      sourceNote: {
        uri: string;
        title: string;
        location: Location<ResourceLink>;
      };
    };

/**
 * Template types supported by the note creation system
 */
export type Template =
  | { type: 'markdown'; content: string; metadata: Map<string, string> }
  | {
      type: 'javascript';
      createNote: (context: TemplateContext) => Promise<NoteCreationResult>;
    };

/**
 * Context provided to JavaScript template functions
 */
export interface TemplateContext {
  /** The trigger that initiated the note creation */
  trigger: NoteCreationTrigger;
  /** Resolver instance for variable resolution */
  resolver: Resolver;
  /** Foam instance for accessing workspace data */
  foam: Foam;
  /** Date used by the resolver for the FOAM_DATE_* variables */
  foamDate: Date;
}

/**
 * Context for creating a note through the unified creation system
 */

/**
 * Result returned by note creation functions
 */
export interface NoteCreationResult {
  filepath: URI;
  content: string;
}

/**
 * A processed template with no target: the note opens in an unsaved editor
 * instead of being written to a file. Only produced for markdown templates
 * that define no `filepath`, and only when the client can open unsaved
 * editors (see `ProcessTemplateOptions.canOpenUnsaved`).
 */
export interface UnsavedNoteResult {
  unsaved: true;
  content: string;
  /**
   * Where the note would be saved, named after the title, when a title is
   * known (the template uses a title variable, or one was given). Relative
   * paths are resolved like a template `filepath`. Absent otherwise.
   */
  suggestedFilepath?: URI;
}

export type ProcessedTemplate = NoteCreationResult | UnsavedNoteResult;

/**
 * Function signature for JavaScript template functions
 */
export type CreateNoteFunction = (
  context: TemplateContext
) => Promise<NoteCreationResult> | NoteCreationResult;

/**
 * Type guard to check if trigger is a command trigger
 */
export function isCommandTrigger(
  trigger: NoteCreationTrigger
): trigger is NoteCreationTrigger & { type: 'command' } {
  return trigger.type === 'command';
}

/**
 * Type guard to check if trigger is a placeholder trigger
 */
export function isPlaceholderTrigger(
  trigger: NoteCreationTrigger
): trigger is NoteCreationTrigger & { type: 'placeholder' } {
  return trigger.type === 'placeholder';
}
