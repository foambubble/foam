import { NoteGraph, Note, NoteLink } from './note-graph';

export {
  createNoteFromMarkdown,
  createMarkdownReferences,
} from './markdown-provider';

export { NoteGraph, Note, NoteLink }

export interface FoamConfig {
  // TODO
}

export interface Foam {
  notes: NoteGraph
  // config: FoamConfig
}

export const createFoam = (config: FoamConfig) => ({
  notes: new NoteGraph(),
  config: config,
})
