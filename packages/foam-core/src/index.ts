import { Note, NoteLink } from './types';
import { NoteGraph, NoteGraphAPI } from './note-graph';
export { FoamConfig } from 'config';

export {
  createMarkdownReferences,
  stringifyMarkdownLinkReferenceDefinition,
} from './markdown-provider';

export {
  TextEdit,
  generateHeading,
  generateLinkReferences,
  getKebabCaseFileName,
} from './janitor';

export { applyTextEdit } from './janitor/apply-text-edit';

export { createConfigFromFolders } from './config';

export { bootstrap } from './bootstrap';

export { NoteGraph, NoteGraphAPI, Note, NoteLink };

export {
  LINK_REFERENCE_DEFINITION_HEADER,
  LINK_REFERENCE_DEFINITION_FOOTER,
} from './definitions';

export interface Foam {
  notes: NoteGraphAPI;
  config: FoamConfig;
  parse: (uri: string, text: string, eol: string) => Note;
}
