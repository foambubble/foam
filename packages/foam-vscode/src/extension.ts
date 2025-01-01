/*global markdownit:readonly*/

import { workspace, ExtensionContext, window, commands } from 'vscode';
import { externalGlobPattern } from './utils/vsc-utils'; 
import { MarkdownResourceProvider } from './core/services/markdown-provider';
import { bootstrap } from './core/model/foam';
import { Logger } from './core/utils/log';

import { features } from './features';
import { VsCodeOutputLogger, exposeLogger } from './services/logging';
import {
  getAttachmentsExtensions,
  getIgnoredFilesSetting,
  getNotesExtensions,
  getExternalWatchPaths,
  getWorkspaceType
} from './settings';
import { AttachmentResourceProvider } from './core/services/attachment-provider';
import { VsCodeWatcher } from './services/watcher';
import { createMarkdownParser } from './core/services/markdown-parser';
import VsCodeBasedParserCache from './services/cache';
import { createMatcherAndDataStore } from './services/editor';

export async function activate(context: ExtensionContext) {
  const logger = new VsCodeOutputLogger();
  Logger.setDefaultLogger(logger);
  exposeLogger(context, logger);

  try {
    Logger.info('Starting Foam');

    if (workspace.workspaceFolders === undefined) {
      Logger.info('No workspace open. Foam will not start');
      return;
    }

    // Prepare Foam
    const excludes = getIgnoredFilesSetting().map(g => g.toString());
    const { matcher, dataStore, excludePatterns } =
      await createMatcherAndDataStore(excludes);

    let watchers: VsCodeWatcher[] = [];

    const workspaceType = getWorkspaceType();
    if(workspaceType == 'internal' || workspaceType == 'combined'){
      Logger.info('Loading from directories:');
      for (const folder of workspace.workspaceFolders) {
        Logger.info('- ' + folder.uri.fsPath);
        Logger.info('  Include: **/*');
        Logger.info('  Exclude: ' + excludePatterns.get(folder.name).join(','));
      }

      const watcher = new VsCodeWatcher(
        workspace.createFileSystemWatcher('**/*')
      );
      watchers.push(watcher);
    } 
    if(workspaceType == 'external' || workspaceType == 'combined') {
      for (const folder of getExternalWatchPaths()) {
        const watcher = new VsCodeWatcher(
          workspace.createFileSystemWatcher(externalGlobPattern(folder))               
        );
        watchers.push(watcher);
      }
    }
    
    const parserCache = new VsCodeBasedParserCache(context);
    const parser = createMarkdownParser([], parserCache);

    const { notesExtensions, defaultExtension } = getNotesExtensions();

    const markdownProvider = new MarkdownResourceProvider(
      dataStore,
      parser,
      notesExtensions
    );

    const attachmentExtConfig = getAttachmentsExtensions();
    const attachmentProvider = new AttachmentResourceProvider(
      attachmentExtConfig
    );

    const foamPromise = bootstrap(
      matcher,
      watchers,
      dataStore,
      parser,
      [markdownProvider, attachmentProvider],
      defaultExtension
    );

    // Load the features
    const featuresPromises = features.map(feature =>
      feature(context, foamPromise)
    );

    const foam = await foamPromise;
    Logger.info(`Loaded ${foam.workspace.list().length} resources`);

    const clearCacheRegCmdDisposable = commands.registerCommand('foam-vscode.clear-cache', () =>
      parserCache.clear()
    );
    const onDidChangeConfigDisposable = workspace.onDidChangeConfiguration(e => {
      if (
        [
          'foam.files.ignore',
          'foam.files.attachmentExtensions',
          'foam.files.noteExtensions',
          'foam.files.defaultNoteExtension',
        ].some(setting => e.affectsConfiguration(setting))
      ) {
        window.showInformationMessage(
          'Foam: Reload the window to use the updated settings'
        );
      }
    });
    for (const watcher of watchers) {
      context.subscriptions.push(
        foam,
        watcher,
        markdownProvider,
        attachmentProvider,
        clearCacheRegCmdDisposable,
        onDidChangeConfigDisposable
      );
    }

    const feats = (await Promise.all(featuresPromises)).filter(r => r != null);

    return {
      extendMarkdownIt: (md: markdownit) => {
        return feats.reduce((acc: markdownit, r: any) => {
          return r.extendMarkdownIt ? r.extendMarkdownIt(acc) : acc;
        }, md);
      },
      foam,
    };
  } catch (e) {
    Logger.error('An error occurred while bootstrapping Foam', e);
    window.showErrorMessage(
      `An error occurred while bootstrapping Foam. ${e.stack}`
    );
  }
}
