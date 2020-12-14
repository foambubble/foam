import { Note, NoteLink } from './types';
import { URI } from './common/uri';
import { NoteGraph, NoteGraphAPI } from './note-graph';
import { FoamConfig } from './config';
import { IDataStore, FileDataStore } from './services/datastore';
import { ILogger } from './utils/log';

export { IDataStore, FileDataStore };
export { ILogger };
export { LogLevel, LogLevelThreshold, Logger, BaseLogger } from './utils/log';
export { IDisposable, isDisposable } from './common/lifecycle';
export { Event, Emitter } from './common/event';
export { FoamConfig };

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

export { NoteGraph, NoteGraphAPI, Note, NoteLink, URI };

export {
  LINK_REFERENCE_DEFINITION_HEADER,
  LINK_REFERENCE_DEFINITION_FOOTER,
} from './definitions';

export interface Services {
  dataStore: IDataStore;
}

export interface Foam {
  notes: NoteGraphAPI;
  config: FoamConfig;
  parse: (uri: URI, text: string, eol: string) => Note;
}
