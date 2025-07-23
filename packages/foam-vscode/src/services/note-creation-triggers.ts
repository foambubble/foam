import { URI } from '../core/model/uri';
import { Location } from '../core/model/location';
import { ResourceLink } from '../core/model/note';
import { NoteCreationTrigger } from './note-creation-types';

/**
 * Factory class for creating different types of note creation triggers
 */
export class TriggerFactory {
  /**
   * Creates a command trigger for note creation initiated by VS Code commands
   *
   * @param command The command name that triggered note creation
   * @param params Optional parameters associated with the command
   * @returns A command trigger object
   */
  static createCommandTrigger(
    command: string,
    params?: Record<string, any>
  ): NoteCreationTrigger {
    return { type: 'command', command, params };
  }

  /**
   * Creates a placeholder trigger for note creation from wikilink placeholders
   *
   * @param sourceUri URI of the source note containing the placeholder
   * @param sourceTitle Title of the source note
   * @param location Location information for the placeholder in the source note
   * @returns A placeholder trigger object
   */
  static createPlaceholderTrigger(
    sourceUri: URI,
    sourceTitle: string,
    location: Location<ResourceLink>
  ): NoteCreationTrigger {
    return {
      type: 'placeholder',
      sourceNote: {
        uri: sourceUri.toString(),
        title: sourceTitle,
        location,
      },
    };
  }
}
