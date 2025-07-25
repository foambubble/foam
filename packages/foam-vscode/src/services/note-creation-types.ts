import { Location } from '../core/model/location';
import { ResourceLink } from '../core/model/note';
import { Foam } from '../core/model/foam';
import { Resolver } from './variable-resolver';
import { URI } from '../core/model/uri';

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
  | { type: 'markdown'; content: string; metadata?: Map<string, string> }
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
