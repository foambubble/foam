/*global markdownit:readonly*/

import { workspace, ExtensionContext, window, commands } from 'vscode';
import { MarkdownResourceProvider, Logger, Config } from '@foam/core';
import { bootstrap } from './core/model/foam';
import { fromVsCodeUri } from './vscode/utils/vsc-utils';

import { features } from './vscode/features';
import { VsCodeOutputLogger, exposeLogger } from './vscode/services/logging';
import { VsCodeFoamConfig } from './vscode/config';
import { AttachmentResourceProvider } from '@foam/core';
import { VsCodeWatcher } from './vscode/services/watcher';
import { createMarkdownParser } from '@foam/core';
import VsCodeBasedParserCache from './vscode/services/cache';
import { createMatcherAndDataStore } from './vscode/services/editor';
import { OllamaEmbeddingProvider } from './ai/providers/ollama/ollama-provider';

export async function activate(context: ExtensionContext) {
  const logger = new VsCodeOutputLogger();
  Logger.setDefaultLogger(logger);
  exposeLogger(context, logger);

  Config.setDefaultConfig(new VsCodeFoamConfig());

  try {
    Logger.info('Starting Foam');

    if (workspace.workspaceFolders === undefined) {
      Logger.info('No workspace open. Foam will not start');
      return;
    }

    // Prepare Foam
    const includes = Config.getFilesInclude();
    const excludes = Config.getFilesExclude();
    const { matcher, dataStore, includePatterns, excludePatterns } =
      await createMatcherAndDataStore(includes, excludes);

    Logger.info('Loading from directories:');
    for (const folder of workspace.workspaceFolders) {
      Logger.info('- ' + folder.uri.fsPath);
      Logger.info('  Include: ' + includePatterns.get(folder.name).join(','));
      Logger.info('  Exclude: ' + excludePatterns.get(folder.name).join(','));
    }

    const watcher = new VsCodeWatcher(
      workspace.createFileSystemWatcher('**/*'),
      workspace.onDidSaveTextDocument
    );
    const parserCache = new VsCodeBasedParserCache(context);
    const parser = createMarkdownParser([], parserCache);

    const notesExtensions = Config.getNotesExtensions();
    const defaultExtension = Config.getDefaultNoteExtension();

    const workspaceRoots =
      workspace.workspaceFolders?.map(folder => fromVsCodeUri(folder.uri)) ??
      [];

    const directoryMode = Config.getLinksDirectoryMode();
    const markdownProvider = new MarkdownResourceProvider(
      dataStore,
      parser,
      notesExtensions,
      directoryMode
    );

    const attachmentExtConfig = Config.getAttachmentExtensions();
    const attachmentProvider = new AttachmentResourceProvider(
      attachmentExtConfig
    );

    // Initialize embedding provider
    const aiEnabled = workspace.getConfiguration('foam.experimental').get('ai');
    const embeddingProvider = aiEnabled
      ? new OllamaEmbeddingProvider()
      : undefined;

    const foamPromise = bootstrap(
      workspaceRoots,
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
