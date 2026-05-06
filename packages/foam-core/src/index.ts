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
export { TextEdit, WorkspaceTextEdit } from './services/text-edit';
export type { WorkspaceTextEditGroup } from './services/text-edit';
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

// Config
export type { IFoamConfig } from './config';
export { Config, DefaultFoamConfig } from './config';

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

// Janitor / lint
export {
  lintNote,
  lintWorkspace,
  computeNoteEdits,
  missingHeadingRule,
  staleDefinitionsRule,
  WorkspaceLintResult,
} from './janitor/janitor';
export type {
  LintRule,
  LintIssue,
  LintRelatedInfo,
  WikilinkDefinitionSetting,
} from './janitor/janitor';
export { generateHeading } from './janitor/generate-headings';
export {
  generateLinkReferences,
  LINK_REFERENCE_DEFINITION_HEADER,
  LINK_REFERENCE_DEFINITION_FOOTER,
} from './janitor/generate-link-references';

// Common
export type { IDisposable } from './common/lifecycle';
export { Emitter } from './common/event';
export type { Event } from './common/event';
export { CancellationTokenSource } from './common/cancellation';
export type { CancellationToken } from './common/cancellation';
export { Variable } from './common/snippetParser';
export { FoamError } from './common/errors';
export type { FoamErrorCode } from './common/errors';

// Commands (high-level workspace operations, used by CLI / MCP / VS Code)
export {
  uriToWorkspacePath,
  getRootUriFor,
  resolveNote,
} from './commands/workspace';
export type { NoteRef } from './commands/workspace';
export {
  listNotes,
  listTags,
  listOrphans,
  listDeadends,
  listPlaceholders,
} from './commands/list';
export type {
  NoteItem,
  NoteSummary,
  TagItem,
  PlaceholderItem,
} from './commands/list';
export { linksData } from './commands/links';
export type { LinkEntry, LinksResult } from './commands/links';
export { outlineData } from './commands/outline';
export type { OutlineSection, OutlineResult } from './commands/outline';
export { searchWorkspace } from './commands/search';
export type {
  SearchMatch,
  PropertyFilter,
  SearchOptions,
} from './commands/search';
export {
  noteShowData,
  noteIdData,
  noteCreate,
  noteMove,
  noteDelete,
} from './commands/note';
export type {
  NoteDetail,
  NoteIdResult,
  NoteCreateResult,
  NoteMoveResult,
  NoteDeleteResult,
} from './commands/note';
export {
  renameNote,
  renameTag,
  renameSection,
  renameBlock,
} from './commands/rename';
export type {
  RenameNoteResult,
  RenameTagResult,
  RenameSectionResult,
  RenameBlockResult,
} from './commands/rename';
export {
  parseFrontmatter,
  stringifyFrontmatter,
  mergeFrontmatter,
  addTagsToFrontmatter,
  removeTagsFromFrontmatter,
} from './commands/frontmatter';
export type { FrontmatterResult } from './commands/frontmatter';
