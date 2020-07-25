import { NoteGraph, Note, NoteLink } from './note-graph';

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

export { initializeNoteGraph } from './initialize-note-graph';

export { NoteGraph, Note, NoteLink };

export {
  LINK_REFERENCE_DEFINITION_HEADER,
  LINK_REFERENCE_DEFINITION_FOOTER,
} from './definitions';

export interface FoamConfig {
  // TODO
}

export interface Foam {
  notes: NoteGraph;
  // config: FoamConfig
}

export const createFoam = (config: FoamConfig) => ({
  notes: new NoteGraph(),
  config: config,
});
