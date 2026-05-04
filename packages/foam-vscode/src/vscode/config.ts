import { Disposable, workspace } from 'vscode';
import { IFoamConfig } from '@foam/core';
import { expandAlternateGroups } from './utils/glob-expand';

export class VsCodeFoamConfig implements IFoamConfig {
  getFilesInclude(): string[] {
    return workspace
      .getConfiguration()
      .get('foam.files.include', ['**/*'])
      .flatMap(expandAlternateGroups);
  }

  getFilesExclude(): string[] {
    return [
      '**/.foam/**',
      ...workspace.getConfiguration().get('foam.files.exclude', []),
      ...workspace.getConfiguration().get('foam.files.ignore', []),
      ...Object.keys(workspace.getConfiguration().get('files.exclude', {})),
    ].flatMap(expandAlternateGroups);
  }

  getDefaultNoteExtension(): string {
    return (
      '.' +
      (
        workspace
          .getConfiguration('foam')
          .get('files.defaultNoteExtension', 'md') ?? 'md'
      ).trim()
    );
  }

  getNotesExtensions(): string[] {
    const defaultExtension = this.getDefaultNoteExtension();
    const extras = workspace
      .getConfiguration('foam')
      .get('files.notesExtensions', '')
      .split(' ')
      .map((e: string) => e.trim())
      .filter((e: string) => e !== '')
      .map((e: string) => '.' + e);
    return [...new Set([...extras, defaultExtension])];
  }

  getAttachmentExtensions(): string[] {
    return workspace
      .getConfiguration('foam')
      .get(
        'files.attachmentExtensions',
        'pdf mp3 webm wav m4a mp4 avi mov rtf txt doc docx pages xls xlsx numbers ppt pptm pptx'
      )
      .split(' ')
      .map((e: string) => '.' + e.trim());
  }

  getNewNotePath(): 'root' | 'currentDir' {
    return workspace
      .getConfiguration('foam')
      .get('files.newNotePath', 'root') as 'root' | 'currentDir';
  }

  getTemplatesFolder(): string {
    return workspace
      .getConfiguration('foam')
      .get('templates.folder', '.foam/templates');
  }

  getDailyNoteDirectory(): string | null {
    return (
      workspace
        .getConfiguration('foam')
        .get<string | null>('openDailyNote.directory', null) ?? null
    );
  }

  getDailyNoteFilenameFormat(): string {
    return workspace
      .getConfiguration('foam')
      .get('openDailyNote.filenameFormat', 'isoDate');
  }

  getDailyNoteFileExtension(): string {
    return workspace
      .getConfiguration('foam')
      .get('openDailyNote.fileExtension', 'md');
  }

  getDailyNoteTitleFormat(): string | null {
    return (
      workspace
        .getConfiguration('foam')
        .get<string | null>('openDailyNote.titleFormat', null) ?? null
    );
  }

  getOpenDailyNoteOnStartup(): boolean {
    return workspace
      .getConfiguration('foam')
      .get('openDailyNote.onStartup', false);
  }

  getDateLocale(): string {
    return workspace.getConfiguration('foam').get('dateLocale', 'default');
  }

  getDateSnippetsAfterCompletion(): 'noop' | 'createNote' | 'navigateToNote' {
    return workspace
      .getConfiguration('foam')
      .get(
        'dateSnippets.afterCompletion',
        'createNote'
      ) as 'noop' | 'createNote' | 'navigateToNote';
  }

  getLinksDirectoryMode(): 'resolve' | 'disabled' {
    return workspace
      .getConfiguration('foam')
      .get('links.directory.mode', 'resolve') as 'resolve' | 'disabled';
  }

  getLinksSyncEnable(): boolean {
    return workspace
      .getConfiguration('foam')
      .get('links.sync.enable', true);
  }

  getLinksHoverEnable(): boolean {
    return workspace
      .getConfiguration('foam')
      .get('links.hover.enable', true);
  }

  getEditLinkReferenceDefinitions(): 'withExtensions' | 'withoutExtensions' | 'off' {
    return workspace
      .getConfiguration('foam')
      .get(
        'edit.linkReferenceDefinitions',
        'off'
      ) as 'withExtensions' | 'withoutExtensions' | 'off';
  }

  getCompletionLabel(): 'path' | 'title' | 'identifier' {
    return workspace
      .getConfiguration('foam')
      .get('completion.label', 'path') as 'path' | 'title' | 'identifier';
  }

  getCompletionUseAlias(): 'never' | 'whenPathDiffersFromTitle' {
    return workspace
      .getConfiguration('foam')
      .get(
        'completion.useAlias',
        'never'
      ) as 'never' | 'whenPathDiffersFromTitle';
  }

  getCompletionLinkFormat(): 'wikilink' | 'link' {
    return workspace
      .getConfiguration('foam')
      .get('completion.linkFormat', 'wikilink') as 'wikilink' | 'link';
  }

  getPreviewEmbedNoteType(): 'full-inline' | 'full-card' | 'content-inline' | 'content-card' {
    return workspace
      .getConfiguration('foam')
      .get(
        'preview.embedNoteType',
        'full-card'
      ) as 'full-inline' | 'full-card' | 'content-inline' | 'content-card';
  }

  getGraphOnStartup(): boolean {
    return workspace
      .getConfiguration('foam')
      .get('graph.onStartup', false);
  }

  getGraphNavigateToPreview(): boolean {
    return workspace
      .getConfiguration('foam')
      .get('graph.navigateToPreview', false);
  }

  getGraphTitleMaxLength(): number {
    return workspace
      .getConfiguration('foam')
      .get('graph.titleMaxLength', 24);
  }

  getGraphStyle(): object {
    return workspace.getConfiguration('foam').get('graph.style', {});
  }

  getSupportedLanguages(): string[] {
    return workspace
      .getConfiguration('foam')
      .get('supportedLanguages', ['markdown']);
  }
}

export interface ConfigurationMonitor<T> extends Disposable {
  (): T;
}

export const getFoamVsCodeConfig = <T>(key: string, defaultValue?: T): T =>
  workspace.getConfiguration('foam').get(key, defaultValue);

export const updateFoamVsCodeConfig = <T>(key: string, value: T) =>
  workspace.getConfiguration().update('foam.' + key, value);

export const monitorFoamVsCodeConfig = <T>(
  key: string
): ConfigurationMonitor<T> => {
  let value: T = getFoamVsCodeConfig(key);
  const listener = workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('foam.' + key)) {
      value = getFoamVsCodeConfig(key);
    }
  });
  const ret = () => {
    return value;
  };
  ret.dispose = () => listener.dispose();
  return ret;
};
