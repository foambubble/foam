import {
  Resource,
  ResourceLink,
  NoteLinkDefinition,
  ResourceParser,
} from './model/note';
import { FoamConfig } from './config';
import {
  IDataStore,
  FileDataStore,
  Matcher,
  IMatcher,
} from './services/datastore';
import { ILogger } from './utils/log';
import { IDisposable, isDisposable } from './common/lifecycle';
import { FoamWorkspace } from './model/workspace';
import { FoamGraph } from '../src/model/graph';
import { URI } from './model/uri';

export { Position } from './model/position';
export { Range } from './model/range';
export { IDataStore, FileDataStore, Matcher, IMatcher };
export { ILogger };
export { LogLevel, LogLevelThreshold, Logger, BaseLogger } from './utils/log';
export { Event, Emitter } from './common/event';
export { FoamConfig };
export { ResourceProvider } from './model/provider';
export { IDisposable, isDisposable };

export {
  createMarkdownReferences,
  stringifyMarkdownLinkReferenceDefinition,
  createMarkdownParser,
  MarkdownResourceProvider,
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
  ResourceLink,
  URI,
  FoamWorkspace,
  FoamGraph,
  NoteLinkDefinition,
  ResourceParser,
};

export interface Services {
  dataStore: IDataStore;
  parser: ResourceParser;
  matcher: IMatcher;
}

export interface Foam extends IDisposable {
  services: Services;
  workspace: FoamWorkspace;
  graph: FoamGraph;
  config: FoamConfig;
}
