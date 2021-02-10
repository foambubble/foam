import {
  Resource,
  Attachment,
  Placeholder,
  Note,
  NoteLink,
  isNote,
  NoteLinkDefinition,
} from './model/note';
import { URI } from './common/uri';
import { FoamConfig } from './config';
import { IDataStore, FileDataStore } from './services/datastore';
import { ILogger } from './utils/log';
import { IDisposable, isDisposable } from './common/lifecycle';
import { FoamWorkspace } from './model/workspace';

export { IDataStore, FileDataStore };
export { ILogger };
export { LogLevel, LogLevelThreshold, Logger, BaseLogger } from './utils/log';
export { Event, Emitter } from './common/event';
export { FoamConfig };

export { IDisposable, isDisposable };

export {
  createMarkdownReferences,
  stringifyMarkdownLinkReferenceDefinition,
} from './markdown-provider';

export {
  TextEdit,
  generateHeading,
  generateLinkReferences,
  getKebabCaseFileName,
  LINK_REFERENCE_DEFINITION_HEADER,
  LINK_REFERENCE_DEFINITION_FOOTER,
} from './janitor';

export { applyTextEdit } from './janitor/apply-text-edit';

export { createConfigFromFolders } from './config';

export { bootstrap } from './bootstrap';

export {
  Resource,
  Attachment,
  Placeholder,
  Note,
  NoteLink,
  URI,
  FoamWorkspace,
  NoteLinkDefinition,
  isNote,
};

export interface Services {
  dataStore: IDataStore;
}

export interface Foam extends IDisposable {
  services: Services;
  workspace: FoamWorkspace;
  config: FoamConfig;
  parse: (uri: URI, text: string, eol: string) => Note;
}
