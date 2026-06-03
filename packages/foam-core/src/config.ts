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

  // Telemetry
  getTelemetryEnabled(): boolean;
}

/**
 * A partial config source — represents one layer of a cascade.
 *
 * Each getter may return a value (the source has an opinion for that key) or
 * be omitted entirely (no opinion; defer to lower-priority sources). The final
 * source in any cascade should be a fully-resolved {@link IFoamConfig} (e.g.
 * {@link DefaultFoamConfig}) so the cascade always resolves to a concrete value.
 */
export type IFoamConfigSource = {
  [K in keyof IFoamConfig]?: IFoamConfig[K];
};

/**
 * Composes layered config sources. Higher-priority sources come first; the
 * cascade returns the first defined value for each getter. The final source
 * must be a fully-resolved {@link IFoamConfig} (no `undefined` returns) so
 * every getter is guaranteed to resolve.
 */
export function cascadeFoamConfig(
  sources: readonly IFoamConfigSource[],
  fallback: IFoamConfig
): IFoamConfig {
  const get = <K extends keyof IFoamConfig>(
    key: K
  ): ReturnType<IFoamConfig[K]> => {
    for (const source of sources) {
      const method = source[key];
      if (method !== undefined) {
        const value = (method as () => ReturnType<IFoamConfig[K]>).call(source);
        if (value !== undefined) {
          return value;
        }
      }
    }
    return fallback[key]() as ReturnType<IFoamConfig[K]>;
  };

  return {
    getFilesInclude: () => get('getFilesInclude'),
    getFilesExclude: () => get('getFilesExclude'),
    getDefaultNoteExtension: () => get('getDefaultNoteExtension'),
    getNotesExtensions: () => get('getNotesExtensions'),
    getAttachmentExtensions: () => get('getAttachmentExtensions'),
    getNewNotePath: () => get('getNewNotePath'),
    getTemplatesFolder: () => get('getTemplatesFolder'),
    getDailyNoteDirectory: () => get('getDailyNoteDirectory'),
    getDailyNoteFilenameFormat: () => get('getDailyNoteFilenameFormat'),
    getDailyNoteFileExtension: () => get('getDailyNoteFileExtension'),
    getDailyNoteTitleFormat: () => get('getDailyNoteTitleFormat'),
    getOpenDailyNoteOnStartup: () => get('getOpenDailyNoteOnStartup'),
    getDateLocale: () => get('getDateLocale'),
    getDateSnippetsAfterCompletion: () => get('getDateSnippetsAfterCompletion'),
    getLinksDirectoryMode: () => get('getLinksDirectoryMode'),
    getLinksSyncEnable: () => get('getLinksSyncEnable'),
    getLinksHoverEnable: () => get('getLinksHoverEnable'),
    getEditLinkReferenceDefinitions: () => get('getEditLinkReferenceDefinitions'),
    getCompletionLabel: () => get('getCompletionLabel'),
    getCompletionUseAlias: () => get('getCompletionUseAlias'),
    getCompletionLinkFormat: () => get('getCompletionLinkFormat'),
    getPreviewEmbedNoteType: () => get('getPreviewEmbedNoteType'),
    getGraphOnStartup: () => get('getGraphOnStartup'),
    getGraphNavigateToPreview: () => get('getGraphNavigateToPreview'),
    getGraphTitleMaxLength: () => get('getGraphTitleMaxLength'),
    getGraphStyle: () => get('getGraphStyle'),
    getSupportedLanguages: () => get('getSupportedLanguages'),
    getTelemetryEnabled: () => get('getTelemetryEnabled'),
  };
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
  getTelemetryEnabled() { return true; }
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
  static getTelemetryEnabled(): boolean { return Config.defaultConfig.getTelemetryEnabled(); }
}
