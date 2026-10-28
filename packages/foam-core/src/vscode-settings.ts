import { IFoamConfig, LegacyDailyNoteSettings } from './config';

interface FoamConfigData {
  filesInclude: string[];
  filesExclude: string[];
  defaultNoteExtension: string;
  notesExtensions: string[];
  attachmentExtensions: string[];
  newNotePath: 'root' | 'currentDir';
  templatesFolder: string;
  legacyDailyNoteSettings: LegacyDailyNoteSettings;
  openDailyNoteOnStartup: boolean;
  dateLocale: string;
  dateSnippetsAfterCompletion: 'noop' | 'createNote' | 'navigateToNote';
  linksDirectoryMode: 'resolve' | 'disabled';
  linksSyncEnable: boolean;
  linksHoverEnable: boolean;
  editLinkReferenceDefinitions: 'withExtensions' | 'withoutExtensions' | 'off';
  completionLabel: 'path' | 'title' | 'identifier';
  completionUseAlias: 'never' | 'whenPathDiffersFromTitle';
  completionLinkFormat: 'wikilink' | 'link';
  previewEmbedNoteType:
    | 'full-inline'
    | 'full-card'
    | 'content-inline'
    | 'content-card';
  graphOnStartup: boolean;
  graphNavigateToPreview: boolean;
  graphTitleMaxLength: number;
  graphStyle: object;
  supportedLanguages: string[];
}

class StaticFoamConfig implements IFoamConfig {
  constructor(private readonly data: FoamConfigData) {}

  getFilesInclude() {
    return this.data.filesInclude;
  }
  getFilesExclude() {
    return this.data.filesExclude;
  }
  getDefaultNoteExtension() {
    return this.data.defaultNoteExtension;
  }
  getNotesExtensions() {
    return this.data.notesExtensions;
  }
  getAttachmentExtensions() {
    return this.data.attachmentExtensions;
  }
  getNewNotePath() {
    return this.data.newNotePath;
  }
  getTemplatesFolder() {
    return this.data.templatesFolder;
  }
  getLegacyDailyNoteSettings() {
    return this.data.legacyDailyNoteSettings;
  }
  getOpenDailyNoteOnStartup() {
    return this.data.openDailyNoteOnStartup;
  }
  getDateLocale() {
    return this.data.dateLocale;
  }
  getDateSnippetsAfterCompletion() {
    return this.data.dateSnippetsAfterCompletion;
  }
  getLinksDirectoryMode() {
    return this.data.linksDirectoryMode;
  }
  getLinksSyncEnable() {
    return this.data.linksSyncEnable;
  }
  getLinksHoverEnable() {
    return this.data.linksHoverEnable;
  }
  getEditLinkReferenceDefinitions() {
    return this.data.editLinkReferenceDefinitions;
  }
  getCompletionLabel() {
    return this.data.completionLabel;
  }
  getCompletionUseAlias() {
    return this.data.completionUseAlias;
  }
  getCompletionLinkFormat() {
    return this.data.completionLinkFormat;
  }
  getPreviewEmbedNoteType() {
    return this.data.previewEmbedNoteType;
  }
  getGraphOnStartup() {
    return this.data.graphOnStartup;
  }
  getGraphNavigateToPreview() {
    return this.data.graphNavigateToPreview;
  }
  getGraphTitleMaxLength() {
    return this.data.graphTitleMaxLength;
  }
  getGraphStyle() {
    return this.data.graphStyle;
  }
  getSupportedLanguages() {
    return this.data.supportedLanguages;
  }
}

/**
 * Paths that are never knowledge base content, excluded regardless of
 * configuration.
 *
 * `foam.files.exclude` is an array setting, so a user value replaces the
 * default instead of extending it — anything left to that default disappears
 * the moment someone adds a single pattern of their own.
 *
 * The VCS entries are spelled `/**` rather than VS Code's bare `**\/.git`
 * because these patterns are also matched with picomatch (see `GlobMatcher`),
 * where a bare directory name matches the directory itself and nothing under
 * it. VS Code's own search engine prunes the folder either way.
 */
export const ALWAYS_EXCLUDED = [
  '**/.foam/**',
  '**/.git/**',
  '**/.hg/**',
  '**/.svn/**',
  '**/.DS_Store',
  '**/Thumbs.db',
];

/** What `foam.files.exclude` excludes when the workspace doesn't set it. */
const DEFAULT_FILES_EXCLUDE = [
  '**/.vscode/**/*',
  '**/_layouts/**/*',
  '**/_site/**/*',
  '**/node_modules/**/*',
  '**/.yarn/**/*',
  '**/vendor/bundle/**/*',
  '**/.venv/**/*',
  '**/venv/**/*',
  '**/env/**/*',
  '**/.env/**/*',
  '**/.direnv/**/*',
  '**/site-packages/**/*',
  '**/target/**/*',
  '**/dist/**/*',
  '**/build/**/*',
  '**/.next/**/*',
  '**/.nuxt/**/*',
  '**/.terraform/**/*',
  '**/.gradle/**/*',
  '**/.idea/**/*',
  '**/.cache/**/*',
  '**/__pycache__/**/*',
];

/**
 * Foam's settings as a workspace's `.vscode/settings.json` declares them, with
 * Foam's defaults for anything absent. `settings` is that file's contents,
 * already parsed (the file is JSONC: comments, trailing commas); anything but
 * an object reads as no settings. Only the workspace's settings are seen:
 * VS Code also merges in the user's own, which this doesn't get.
 */
export function foamConfigFromVsCodeSettings(settings: unknown): IFoamConfig {
  const raw: Record<string, unknown> =
    settings !== null &&
    typeof settings === 'object' &&
    !Array.isArray(settings)
      ? (settings as Record<string, unknown>)
      : {};

  const defaultNoteExtension =
    '.' + (getString(raw, 'foam.files.defaultNoteExtension') ?? 'md').trim();

  const extraExtensions = (getString(raw, 'foam.files.notesExtensions') ?? '')
    .split(' ')
    .map(e => e.trim())
    .filter(e => e !== '')
    .map(e => '.' + e);

  const notesExtensions = uniq([...extraExtensions, defaultNoteExtension]);

  const filesExclude: string[] = [
    ...ALWAYS_EXCLUDED,
    ...getStringArray(raw, 'foam.files.exclude', DEFAULT_FILES_EXCLUDE),
    ...getStringArray(raw, 'foam.files.ignore'),
    ...Object.keys(getObject(raw, 'files.exclude')),
  ];

  return new StaticFoamConfig({
    filesInclude: getStringArray(raw, 'foam.files.include', ['**/*']),
    filesExclude,
    defaultNoteExtension,
    notesExtensions,
    attachmentExtensions: (
      getString(raw, 'foam.files.attachmentExtensions') ??
      'pdf mp3 webm wav m4a mp4 avi mov rtf txt doc docx pages xls xlsx numbers ppt pptm pptx'
    )
      .split(' ')
      .map(e => '.' + e.trim()),
    newNotePath: (getString(raw, 'foam.files.newNotePath') ?? 'root') as
      | 'root'
      | 'currentDir',
    templatesFolder:
      getString(raw, 'foam.templates.folder') ?? '.foam/templates',
    legacyDailyNoteSettings: {
      directory: getString(raw, 'foam.openDailyNote.directory'),
      filenameFormat: getString(raw, 'foam.openDailyNote.filenameFormat'),
      fileExtension: getString(raw, 'foam.openDailyNote.fileExtension'),
      titleFormat: getString(raw, 'foam.openDailyNote.titleFormat'),
    },
    openDailyNoteOnStartup: getBoolean(
      raw,
      'foam.openDailyNote.onStartup',
      false
    ),
    dateLocale: getString(raw, 'foam.dateLocale') ?? 'default',
    dateSnippetsAfterCompletion: (getString(
      raw,
      'foam.dateSnippets.afterCompletion'
    ) ?? 'createNote') as 'noop' | 'createNote' | 'navigateToNote',
    linksDirectoryMode: (getString(raw, 'foam.links.directory.mode') ??
      'resolve') as 'resolve' | 'disabled',
    linksSyncEnable: getBoolean(raw, 'foam.links.sync.enable', true),
    linksHoverEnable: getBoolean(raw, 'foam.links.hover.enable', true),
    editLinkReferenceDefinitions: (getString(
      raw,
      'foam.edit.linkReferenceDefinitions'
    ) ?? 'off') as 'withExtensions' | 'withoutExtensions' | 'off',
    completionLabel: (getString(raw, 'foam.completion.label') ?? 'path') as
      | 'path'
      | 'title'
      | 'identifier',
    completionUseAlias: (getString(raw, 'foam.completion.useAlias') ??
      'never') as 'never' | 'whenPathDiffersFromTitle',
    completionLinkFormat: (getString(raw, 'foam.completion.linkFormat') ??
      'wikilink') as 'wikilink' | 'link',
    previewEmbedNoteType: (getString(raw, 'foam.preview.embedNoteType') ??
      'full-card') as
      | 'full-inline'
      | 'full-card'
      | 'content-inline'
      | 'content-card',
    graphOnStartup: getBoolean(raw, 'foam.graph.onStartup', false),
    graphNavigateToPreview: getBoolean(
      raw,
      'foam.graph.navigateToPreview',
      false
    ),
    graphTitleMaxLength: getNumber(raw, 'foam.graph.titleMaxLength', 24),
    graphStyle: getObject(raw, 'foam.graph.style'),
    supportedLanguages: getStringArray(raw, 'foam.supportedLanguages', [
      'markdown',
    ]),
  });
}

function getString(
  obj: Record<string, unknown>,
  key: string
): string | undefined {
  const val = obj[key];
  return typeof val === 'string' ? val : undefined;
}

function getBoolean(
  obj: Record<string, unknown>,
  key: string,
  defaultVal: boolean
): boolean {
  const val = obj[key];
  return typeof val === 'boolean' ? val : defaultVal;
}

function getNumber(
  obj: Record<string, unknown>,
  key: string,
  defaultVal: number
): number {
  const val = obj[key];
  return typeof val === 'number' ? val : defaultVal;
}

function getStringArray(
  obj: Record<string, unknown>,
  key: string,
  defaultVal: string[] = []
): string[] {
  const val = obj[key];
  if (!Array.isArray(val)) return defaultVal;
  return val.filter((v): v is string => typeof v === 'string');
}

function getObject(
  obj: Record<string, unknown>,
  key: string
): Record<string, unknown> {
  const val = obj[key];
  return val !== null && typeof val === 'object' && !Array.isArray(val)
    ? (val as Record<string, unknown>)
    : {};
}

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}
