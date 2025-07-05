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
 * Context provided to note creation functions, containing all necessary
 * information and utilities for creating notes
 */
export interface NoteCreationContext {
  trigger: NoteCreationTrigger;
  template: string; // Path to template (JS or MD)
  extraParams: Record<string, any>;
  foam: Foam;

  // Template expansion utility function
  expandTemplate: (
    templatePath: string,
    variables?: Record<string, string>
  ) => Promise<{
    content: string;
    metadata: Map<string, string>;
  }>;
}

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
  context: NoteCreationContext
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
