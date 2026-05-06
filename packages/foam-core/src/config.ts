export interface IFoamConfig {
  // Files
  getFilesInclude(): string[];
  getFilesExclude(): string[];
  getDefaultNoteExtension(): string;
  getNotesExtensions(): string[];
  getAttachmentExtensions(): string[];
  getNewNotePath(): 'root' | 'currentDir';

  // Templates
  getTemplatesFolder(): string;

  // Daily notes
  getDailyNoteDirectory(): string | null;
  getDailyNoteFilenameFormat(): string;
  getDailyNoteFileExtension(): string;
  getDailyNoteTitleFormat(): string | null;
  getOpenDailyNoteOnStartup(): boolean;

  // Date
  getDateLocale(): string;
  getDateSnippetsAfterCompletion(): 'noop' | 'createNote' | 'navigateToNote';

  // Links
  getLinksDirectoryMode(): 'resolve' | 'disabled';
  getLinksSyncEnable(): boolean;
  getLinksHoverEnable(): boolean;
  getEditLinkReferenceDefinitions(): 'withExtensions' | 'withoutExtensions' | 'off';

  // Completion
  getCompletionLabel(): 'path' | 'title' | 'identifier';
  getCompletionUseAlias(): 'never' | 'whenPathDiffersFromTitle';
  getCompletionLinkFormat(): 'wikilink' | 'link';

  // Preview
  getPreviewEmbedNoteType(): 'full-inline' | 'full-card' | 'content-inline' | 'content-card';

  // Graph
  getGraphOnStartup(): boolean;
  getGraphNavigateToPreview(): boolean;
  getGraphTitleMaxLength(): number;
  getGraphStyle(): object;

  // Languages
  getSupportedLanguages(): string[];
}

export class DefaultFoamConfig implements IFoamConfig {
  getFilesInclude() { return ['**/*']; }
  getFilesExclude() { return []; }
  getDefaultNoteExtension() { return '.md'; }
  getNotesExtensions() { return ['.md']; }
  getAttachmentExtensions() {
    return 'pdf mp3 webm wav m4a mp4 avi mov rtf txt doc docx pages xls xlsx numbers ppt pptm pptx'
      .split(' ').map(e => '.' + e);
  }
  getNewNotePath(): 'root' | 'currentDir' { return 'root'; }
  getTemplatesFolder() { return '.foam/templates'; }
  getDailyNoteDirectory(): string | null { return null; }
  getDailyNoteFilenameFormat() { return 'isoDate'; }
  getDailyNoteFileExtension() { return 'md'; }
  getDailyNoteTitleFormat(): string | null { return null; }
  getOpenDailyNoteOnStartup() { return false; }
  getDateLocale() { return 'default'; }
  getDateSnippetsAfterCompletion(): 'noop' | 'createNote' | 'navigateToNote' { return 'createNote'; }
  getLinksDirectoryMode(): 'resolve' | 'disabled' { return 'resolve'; }
  getLinksSyncEnable() { return true; }
  getLinksHoverEnable() { return true; }
  getEditLinkReferenceDefinitions(): 'withExtensions' | 'withoutExtensions' | 'off' { return 'off'; }
  getCompletionLabel(): 'path' | 'title' | 'identifier' { return 'path'; }
  getCompletionUseAlias(): 'never' | 'whenPathDiffersFromTitle' { return 'never'; }
  getCompletionLinkFormat(): 'wikilink' | 'link' { return 'wikilink'; }
  getPreviewEmbedNoteType(): 'full-inline' | 'full-card' | 'content-inline' | 'content-card' { return 'full-card'; }
  getGraphOnStartup() { return false; }
  getGraphNavigateToPreview() { return false; }
  getGraphTitleMaxLength() { return 24; }
  getGraphStyle() { return {}; }
  getSupportedLanguages() { return ['markdown']; }
}

/**
 * Static accessor for the active {@link IFoamConfig}.
 *
 * The config is global state seeded with {@link DefaultFoamConfig} at module
 * load. Hosts (CLI's `loadWorkspaceFromDirectory`, the VS Code extension's
 * `activate`) call {@link setDefaultConfig} to install workspace-aware
 * settings before any command runs.
 *
 * If a caller forgets to initialize, `Config` returns the defaults silently
 * — that's the deliberate fallback so that small isolated calls (tests,
 * library consumers) work without ceremony. The cost is that user-configured
 * settings won't take effect; hosts must call `setDefaultConfig` exactly
 * once at bootstrap.
 */
export class Config {
  private static defaultConfig: IFoamConfig = new DefaultFoamConfig();

  static setDefaultConfig(config: IFoamConfig): void {
    Config.defaultConfig = config;
  }

  static getFilesInclude(): string[] { return Config.defaultConfig.getFilesInclude(); }
  static getFilesExclude(): string[] { return Config.defaultConfig.getFilesExclude(); }
  static getDefaultNoteExtension(): string { return Config.defaultConfig.getDefaultNoteExtension(); }
  static getNotesExtensions(): string[] { return Config.defaultConfig.getNotesExtensions(); }
  static getAttachmentExtensions(): string[] { return Config.defaultConfig.getAttachmentExtensions(); }
  static getNewNotePath(): 'root' | 'currentDir' { return Config.defaultConfig.getNewNotePath(); }
  static getTemplatesFolder(): string { return Config.defaultConfig.getTemplatesFolder(); }
  static getDailyNoteDirectory(): string | null { return Config.defaultConfig.getDailyNoteDirectory(); }
  static getDailyNoteFilenameFormat(): string { return Config.defaultConfig.getDailyNoteFilenameFormat(); }
  static getDailyNoteFileExtension(): string { return Config.defaultConfig.getDailyNoteFileExtension(); }
  static getDailyNoteTitleFormat(): string | null { return Config.defaultConfig.getDailyNoteTitleFormat(); }
  static getOpenDailyNoteOnStartup(): boolean { return Config.defaultConfig.getOpenDailyNoteOnStartup(); }
  static getDateLocale(): string { return Config.defaultConfig.getDateLocale(); }
  static getDateSnippetsAfterCompletion(): 'noop' | 'createNote' | 'navigateToNote' { return Config.defaultConfig.getDateSnippetsAfterCompletion(); }
  static getLinksDirectoryMode(): 'resolve' | 'disabled' { return Config.defaultConfig.getLinksDirectoryMode(); }
  static getLinksSyncEnable(): boolean { return Config.defaultConfig.getLinksSyncEnable(); }
  static getLinksHoverEnable(): boolean { return Config.defaultConfig.getLinksHoverEnable(); }
  static getEditLinkReferenceDefinitions(): 'withExtensions' | 'withoutExtensions' | 'off' { return Config.defaultConfig.getEditLinkReferenceDefinitions(); }
  static getCompletionLabel(): 'path' | 'title' | 'identifier' { return Config.defaultConfig.getCompletionLabel(); }
  static getCompletionUseAlias(): 'never' | 'whenPathDiffersFromTitle' { return Config.defaultConfig.getCompletionUseAlias(); }
  static getCompletionLinkFormat(): 'wikilink' | 'link' { return Config.defaultConfig.getCompletionLinkFormat(); }
  static getPreviewEmbedNoteType(): 'full-inline' | 'full-card' | 'content-inline' | 'content-card' { return Config.defaultConfig.getPreviewEmbedNoteType(); }
  static getGraphOnStartup(): boolean { return Config.defaultConfig.getGraphOnStartup(); }
  static getGraphNavigateToPreview(): boolean { return Config.defaultConfig.getGraphNavigateToPreview(); }
  static getGraphTitleMaxLength(): number { return Config.defaultConfig.getGraphTitleMaxLength(); }
  static getGraphStyle(): object { return Config.defaultConfig.getGraphStyle(); }
  static getSupportedLanguages(): string[] { return Config.defaultConfig.getSupportedLanguages(); }
}
