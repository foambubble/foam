/*global markdownit:readonly*/

import { workspace, ExtensionContext, window, commands } from 'vscode';
import { MarkdownResourceProvider } from './core/services/markdown-provider';
import { bootstrap } from './core/model/foam';
import { Logger } from './core/utils/log';
import { fromVsCodeUri } from './utils/vsc-utils';

import { features } from './features';
import { VsCodeOutputLogger, exposeLogger } from './services/logging';
import {
  getAttachmentsExtensions,
  getExcludedFilesSetting,
  getIncludeFilesSetting,
  getNotesExtensions,
} from './settings';
import { AttachmentResourceProvider } from './core/services/attachment-provider';
import { VsCodeWatcher } from './services/watcher';
import { createMarkdownParser } from './core/services/markdown-parser';
import VsCodeBasedParserCache from './services/cache';
import { createMatcherAndDataStore } from './services/editor';
import { OllamaEmbeddingProvider } from './ai/providers/ollama/ollama-provider';

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
    const includes = getIncludeFilesSetting().map(g => g.toString());
    const excludes = getExcludedFilesSetting().map(g => g.toString());
    const { matcher, dataStore, includePatterns, excludePatterns } =
      await createMatcherAndDataStore(includes, excludes);

    Logger.info('Loading from directories:');
    for (const folder of workspace.workspaceFolders) {
      Logger.info('- ' + folder.uri.fsPath);
      Logger.info('  Include: ' + includePatterns.get(folder.name).join(','));
      Logger.info('  Exclude: ' + excludePatterns.get(folder.name).join(','));
    }

    const watcher = new VsCodeWatcher(
      workspace.createFileSystemWatcher('**/*')
    );
    const parserCache = new VsCodeBasedParserCache(context);
    const parser = createMarkdownParser([], parserCache);

    const { notesExtensions, defaultExtension } = getNotesExtensions();

    // Get workspace roots for workspace-relative path resolution
    const workspaceRoots =
      workspace.workspaceFolders?.map(folder => fromVsCodeUri(folder.uri)) ??
      [];

    const markdownProvider = new MarkdownResourceProvider(
      dataStore,
      parser,
      notesExtensions,
      workspaceRoots
    );

    const attachmentExtConfig = getAttachmentsExtensions();
    const attachmentProvider = new AttachmentResourceProvider(
      attachmentExtConfig
    );

    // Initialize embedding provider
    const aiEnabled = workspace.getConfiguration('foam.experimental').get('ai');
    const embeddingProvider = aiEnabled
      ? new OllamaEmbeddingProvider()
      : undefined;

    const foamPromise = bootstrap(
      matcher,
      watcher,
      dataStore,
      parser,
      [markdownProvider, attachmentProvider],
      defaultExtension,
      embeddingProvider
    );

    // Load the features
    const featuresPromises = features.map(feature =>
      feature(context, foamPromise)
    );

    const foam = await foamPromise;
    Logger.info(`Loaded ${foam.workspace.list().length} resources`);

    context.subscriptions.push(
      foam,
      watcher,
      markdownProvider,
      attachmentProvider,
      commands.registerCommand('foam-vscode.clear-cache', () =>
        parserCache.clear()
      ),
      workspace.onDidChangeConfiguration(e => {
        if (
          [
            'foam.files.ignore',
            'foam.files.exclude',
            'foam.files.include',
            'foam.files.attachmentExtensions',
            'foam.files.noteExtensions',
            'foam.files.defaultNoteExtension',
          ].some(setting => e.affectsConfiguration(setting))
        ) {
          window.showInformationMessage(
            'Foam: Reload the window to use the updated settings'
          );
        }
      })
    );

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
