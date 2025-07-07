import { Location } from '../core/model/location';
import { ResourceLink } from '../core/model/note';
import { Foam } from '../core/model/foam';

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
  /** Additional parameters for template processing */
  extraParams: Record<string, any>;
  /** Foam instance for accessing workspace data */
  foam: Foam;
}

/**
 * Context for creating a note through the unified creation system
 */

/**
 * Result returned by note creation functions
 */
export interface NoteCreationResult {
  filepath: string;
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
