// Core models
export { URI, asAbsoluteUri } from './model/uri';
export type { URIComponents } from './model/uri';
export { Range } from './model/range';
export { Position } from './model/position';
export { Location } from './model/location';
export { Resource, ResourceLink, NoteLinkDefinition, Block, Footnote } from './model/note';
export type { ResourceParser, ResourceJson, Tag, Section } from './model/note';
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
export { createMarkdownParser, getLinkDefinitions, getBlockFor } from './services/markdown-parser';
export type { ParserPlugin, ParserCache, ParserCacheEntry } from './services/markdown-parser';
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
export {
  getDailyNoteTemplateCandidateUris,
  getNewNoteTemplateCandidateUris,
  getTemplatesDir,
} from './templates/template-discovery';
export { Resolver } from './templates/variable-resolver';
export type { VariableProvider } from './templates/variable-resolver';

// Query
export type {
  QueryFilter,
  QueryDescriptor,
  ResourceView,
  SourceReader,
  SelectInput,
  SelectEntry,
} from './query/index';
export {
  parseFilter,
  QueryResult,
  executeQuery,
  ALL_QUERY_FIELDS,
  requiresSource,
  beautifyFieldLabel,
  normalizeSelectEntry,
  tryBuildUserRegex,
} from './query/index';
export { renderDqlQuery } from './query/dql';
export type { RenderDqlQueryOptions } from './query/dql';
export { renderJsQuery } from './query/js';
export type { RenderJsQueryOptions } from './query/js';
export type { Query, ParseQueryResult } from './query/saved';
export {
  parseQuery,
  serializeQuery,
  idFromQueryFilename,
  filenameFromQueryId,
  humanizeQueryId,
  sanitizeQueryId,
} from './query/saved';
export type { LoadedQuery, QueryDataStoreOps } from './query/saved-store';
export {
  QueryStore,
  QUERIES_DIR,
  QUERIES_GLOB,
  createQueryDataStore,
} from './query/saved-store';
export {
  escapeHtml,
  noteLink,
  renderList,
  renderTable,
  renderCount,
  renderResults,
} from './query/html';
export type {
  FoamQueryRenderEvent,
  MarkdownRenderer,
  MarkdownRenderOptions,
  QueryRender,
  QueryResultShape,
  ToHref,
} from './query/html';
export type { RenderContext } from './query/render-context';
export { createRenderContext } from './query/render-context';

// Config
export type { IFoamConfig, IFoamConfigSource } from './config';
export { Config, DefaultFoamConfig, cascadeFoamConfig } from './config';

// Utilities
export { Logger, BaseLogger, ConsoleLogger, NoOpLogger } from './utils/log';
export type { ILogger, LogLevel, LogLevelThreshold } from './utils/log';
export { toSlug } from './utils/slug';
export { isSubsequence } from './utils/string';
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
export {
  extractFoamTemplateFrontmatterMetadata,
  removeFoamMetadata,
} from './utils/template-frontmatter-parser';
export {
  joinPath,
  changeExtension,
  isWithinPath,
  asAbsolutePaths,
  relativeTo,
  fromFsPath,
} from './utils/path';
export { isWindows, isMacintosh, isLinux } from './common/platform';
export { TaskDeduplicator } from './utils/task-deduplicator';
export type { Progress, ProgressCallback } from './services/progress';
export { CancellationError } from './services/progress';
export type {
  ITelemetryReporter,
  WorkspaceSizeBucket,
  DurationBucket,
  ConsentValue,
  ConsentInput,
  ConsentDecision,
  AppInsightsConnection,
  AppInsightsEventInput,
} from './services/telemetry';
export {
  NoopTelemetryReporter,
  InMemoryTelemetryReporter,
  bucketNoteCount,
  bucketDuration,
  TELEMETRY_CONNECTION_STRING,
  TELEMETRY_FIRST_RUN_NOTICE,
  TELEMETRY_NON_INTERACTIVE_NOTICE,
  decideConsent,
  parseAppInsightsConnectionString,
  buildAppInsightsEnvelope,
} from './services/telemetry';

// Graph builder
export { buildGraphData } from './services/graph-data-builder';
export type {
  GraphNodeData,
  BuiltGraphData,
  GraphBuilderOptions,
} from './services/graph-data-builder';

// Export pipeline (workspace → static-site artifact set)
export { buildSite } from './export';
export { exportAssets } from './export/asset-filters';
export {
  selectAll,
  selectWhere,
  selectByUris,
} from './export/selectors';
export {
  getWorkspaceRelativePath,
  getContentRelativePath,
} from './export/derive/build-route-manifest';
export { slugifyUrlSegment, slugifyUrlPath } from './export/slug';
export type { SlugifyUrlPathOptions } from './export/slug';
export type {
  ExportConfig,
  ExportSiteConfig,
  ExportSelector,
  ExportAssetMatcher,
  ExportAssetContext,
  ExportHomepageMatcher,
  ExportValueResolver,
  ExportRuntimeContext,
  ExportSiteContext,
  ExportContext,
  ExportArtifactSet,
  ExportedNote,
  ExportedAsset,
  ExportedRoute,
  ExportedSite,
  ExportedBacklink,
  ExportedDiagnostic,
  ExportedGraphData,
  ExportedGraphNode,
  ExportedGraphLink,
} from './export/types';
export type {
  PublishTarget,
  PublishLocator,
  PublishLocation,
  AssetStrategy,
  AssetResolution,
  SourceLinkRewriter,
  ResolvedLink,
  LinkRewriteResult,
} from './export/target';

// Lint
export {
  lintNote,
  lintWorkspace,
  computeNoteEdits,
  missingHeadingRule,
  staleDefinitionsRule,
  WorkspaceLintResult,
} from './lint/lint';
export type { LintRule, LintIssue, LintRelatedInfo, WikilinkDefinitionSetting } from './lint/lint';
export { generateHeading } from './lint/generate-headings';
export {
  generateLinkReferences,
  LINK_REFERENCE_DEFINITION_HEADER,
  LINK_REFERENCE_DEFINITION_FOOTER,
} from './lint/generate-link-references';

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
export { uriToWorkspacePath, getRootUriFor, resolveNote } from './commands/workspace';
export type { NoteRef } from './commands/workspace';
export { listNotes, listTags, listOrphans, listDeadends, listPlaceholders } from './commands/list';
export type {
  NoteItem,
  NoteSummary,
  TagItem,
  PlaceholderItem,
  OrphansOptions,
} from './commands/list';
export { linksData, traverseGraph } from './commands/links';
export type {
  LinkEntry,
  LinksResult,
  TraversalDirection,
  TraversalNode,
  TraversalEdge,
  TraversalResult,
} from './commands/links';
export { outlineData } from './commands/outline';
export type { OutlineSection, OutlineResult } from './commands/outline';
export { searchWorkspace } from './commands/search';
export type { SearchMatch, PropertyFilter, SearchOptions } from './commands/search';
export { noteShowData, noteIdData, noteCreate, noteMove, noteDelete } from './commands/note';
export type {
  NoteDetail,
  NoteIdResult,
  NoteCreateResult,
  NoteMoveResult,
  NoteDeleteResult,
} from './commands/note';
export { renameNote, renameTag, renameSection, renameBlock } from './commands/rename';
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
