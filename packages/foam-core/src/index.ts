import { NoteGraph, Note, NoteLink, NoteGraphAPI } from './note-graph';

export {
  createNoteFromMarkdown,
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

export interface FoamConfig {
  pluginPaths: string[];
  foamFolders: string[];
}

export interface Foam {
  notes: NoteGraphAPI;
  config: FoamConfig;
}
