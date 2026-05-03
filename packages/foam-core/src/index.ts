// Core models
export { URI, asAbsoluteUri } from './model/uri';
export { Range } from './model/range';
export { Position } from './model/position';
export { Location } from './model/location';
export {
  Resource,
  ResourceLink,
  NoteLinkDefinition,
  Block,
  Footnote,
} from './model/note';
export type {
  ResourceParser,
  Tag,
  Section,
} from './model/note';
export { FoamWorkspace } from './model/workspace';
export { FoamGraph } from './model/graph';
export type { Connection } from './model/graph';
export { FoamTags } from './model/tags';
export type { ResourceProvider } from './model/provider';
export type { Foam, Services } from './model/foam';
export { bootstrap } from './model/foam';

// Services
export type { IDataStore, IWatcher, IMatcher } from './services/datastore';
export {
  GenericDataStore,
  FileListBasedMatcher,
  AlwaysIncludeMatcher,
  SubstringExcludeMatcher,
} from './services/datastore';
export {
  createMarkdownParser,
  getLinkDefinitions,
  getBlockFor,
} from './services/markdown-parser';
export type {
  ParserPlugin,
  ParserCache,
  ParserCacheEntry,
} from './services/markdown-parser';
export { MarkdownResourceProvider, createMarkdownReferences } from './services/markdown-provider';
export {
  AttachmentResourceProvider,
  imageExtensions,
  defaultAttachmentExtensions,
} from './services/attachment-provider';
export { TextEdit } from './services/text-edit';
export type { WorkspaceTextEdit } from './services/text-edit';
export { MarkdownLink } from './services/markdown-link';
export { HeadingEdit } from './services/heading-edit';
export type { HeadingEditResult } from './services/heading-edit';
export { TagEdit } from './services/tag-edit';
export type { TagEditResult } from './services/tag-edit';
export {
  computeWikilinkRenameEdits,
  computeDirectoryWikilinkRenameEdits,
} from './services/link-integrity';

// Templates / note creation
export { NoteCreationEngine } from './templates/note-creation-engine';
export type { NoteCreationResult } from './templates/note-creation-types';
export type { Template, TemplateContext } from './templates/note-creation-types';
export { TriggerFactory } from './templates/note-creation-triggers';
export { resolveDailyNote } from './templates/daily-note-resolver';
export type { ResolveDailyNoteOptions } from './templates/daily-note-resolver';
export { TemplateLoader } from './templates/template-loader';
export { getDailyNoteTemplateCandidateUris, getNewNoteTemplateCandidateUris, getTemplatesDir } from './templates/template-discovery';
export { Resolver } from './templates/variable-resolver';
export type { VariableProvider } from './templates/variable-resolver';

// Query
export type { QueryFilter, QueryDescriptor, ResourceView } from './query/index';
export { parseFilter, QueryResult, executeQuery, ALL_QUERY_FIELDS } from './query/index';
export { renderDqlQuery } from './query/dql';
export { renderJsQuery } from './query/js';
export { escapeHtml, noteLink, renderList, renderTable, renderCount, renderResults } from './query/html';

// Utilities
export { Logger, BaseLogger, ConsoleLogger, NoOpLogger } from './utils/log';
export type { ILogger, LogLevel, LogLevelThreshold } from './utils/log';
export { toSlug } from './utils/slug';
export { extractHashtags, extractTagsFromProp, HASHTAG_REGEX } from './utils/hashtags';
export {
  getExcerpt,
  stripFrontMatter,
  stripImages,
  isInFrontMatter,
  isOnYAMLKeywordLine,
} from './utils/md';
export type { ICache } from './utils/cache';
export { isNotNull, isSome, isNone, isNumeric, hash, firstFrom, lazyExecutor } from './utils/core';
export { getHeadingFromFileName } from './utils/index';
export { extractFoamTemplateFrontmatterMetadata, removeFoamMetadata } from './utils/template-frontmatter-parser';
export {
  joinPath,
  changeExtension,
  isWithinPath,
  asAbsolutePaths,
} from './utils/path';
export { isWindows, isMacintosh, isLinux } from './common/platform';
export { TaskDeduplicator } from './utils/task-deduplicator';
export type { Progress, ProgressCallback } from './services/progress';
export { CancellationError } from './services/progress';

// Graph builder
export { buildGraphData } from './services/graph-data-builder';
export type {
  GraphNodeData,
  BuiltGraphData,
  GraphBuilderOptions,
} from './services/graph-data-builder';

// Common
export type { IDisposable } from './common/lifecycle';
export { Emitter } from './common/event';
export type { Event } from './common/event';
export { CancellationTokenSource } from './common/cancellation';
export type { CancellationToken } from './common/cancellation';
export { Variable } from './common/snippetParser';
