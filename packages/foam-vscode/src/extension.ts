/*global markdownit:readonly*/

import {
  workspace,
  ExtensionContext,
  window,
  commands,
  TextEditor,
  RelativePattern,
} from 'vscode';
import {
  MarkdownResourceProvider,
  Logger,
  Config,
  LoadProfiler,
  EventLoopMonitor,
  formatMemoryUsage,
} from '@foam/core';
import { bootstrap } from './core/model/foam';
import { fromVsCodeUri } from './vscode/utils/vsc-utils';

import { features } from './vscode/features';
import { FoamFeatureResult } from './types';
import { VsCodeOutputLogger, exposeLogger } from './vscode/services/logging';
import { VsCodeFoamConfig } from './vscode/config';
import { AttachmentResourceProvider } from '@foam/core';
import { VsCodeWatcher } from './vscode/services/watcher';
import { createMarkdownParser } from '@foam/core';
import VsCodeBasedParserCache from './vscode/services/cache';
import { createMatcherAndDataStore } from './vscode/services/editor';
import { buildWatchGlob } from './vscode/utils/watch-glob';
import { OllamaEmbeddingProvider } from './ai/providers/ollama/ollama-provider';
import { initTelemetry } from './vscode/services/telemetry';

// Injected by esbuild's `define` (and the vitest config), so telemetry can
// attach version dimensions without a runtime package.json read
declare const __FOAM_VSCODE_VERSION__: string;
declare const __CORE_VERSION__: string;

export async function activate(context: ExtensionContext) {
  const logger = new VsCodeOutputLogger();
  Logger.setDefaultLogger(logger);
  exposeLogger(context, logger);

  Config.setDefaultConfig(new VsCodeFoamConfig());
  try {
    const telemetry = initTelemetry({
      foamVersion: __FOAM_VSCODE_VERSION__,
      coreVersion: __CORE_VERSION__,
    });
    context.subscriptions.push(telemetry);
    telemetry.trackSession();

    Logger.info('Starting Foam');

    if (workspace.workspaceFolders === undefined) {
      Logger.info('No workspace open. Foam will not start');
      return;
    }

    context.subscriptions.push(
      window.onDidChangeActiveTextEditor((editor: TextEditor | undefined) => {
        if (editor?.document.languageId === 'markdown') {
          telemetry.trackNoteOpened();
        }
      })
    );

    // Prepare Foam
    const includes = Config.getFilesInclude();
    const excludes = Config.getFilesExclude();
    const {
      matcher,
      dataStore: rawDataStore,
      includePatterns,
      excludePatterns,
    } = await createMatcherAndDataStore(includes, excludes);

    Logger.info('Loading from directories:');
    for (const folder of workspace.workspaceFolders) {
      Logger.info('- ' + folder.uri.fsPath);
      Logger.info('  Include: ' + includePatterns.get(folder.name).join(','));
      Logger.info('  Exclude: ' + excludePatterns.get(folder.name).join(','));
    }

    const notesExtensions = Config.getNotesExtensions();
    const defaultExtension = Config.getDefaultNoteExtension();
    const attachmentExtConfig = Config.getAttachmentExtensions();

    const watchGlob = buildWatchGlob([
      ...notesExtensions,
      ...attachmentExtConfig,
    ]);
    const watcher = new VsCodeWatcher(
      workspace.workspaceFolders.map(folder =>
        workspace.createFileSystemWatcher(
          new RelativePattern(folder.uri, watchGlob)
        )
      ),
      workspace.onDidSaveTextDocument
    );
    context.subscriptions.push(watcher);
    // Attributes the workspace load time to reading vs parsing vs neither, so
    // that a slow startup reported by a user can be diagnosed from the log
    // alone. See issue #1689.
    const profiler = new LoadProfiler();
    const eventLoopMonitor = new EventLoopMonitor();

    const dataStore = profiler.instrumentDataStore(rawDataStore);

    const parserCache = await VsCodeBasedParserCache.create(context);
    context.subscriptions.push(parserCache);
    const parser = createMarkdownParser([], parserCache, profiler.onParse);

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

    const attachmentProvider = new AttachmentResourceProvider(
      attachmentExtConfig
    );
    context.subscriptions.push(markdownProvider, attachmentProvider);

    // Initialize embedding provider
    const experimentalEnabled = workspace
      .getConfiguration('foam')
      .get('experimental');
    const embeddingProvider = experimentalEnabled
      ? new OllamaEmbeddingProvider()
      : undefined;

    profiler.start();
    eventLoopMonitor.start();

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
    // Register for disposal right away: a feature failing to load further
    // down must not leave the workspace/graph/watchers alive and untracked
    context.subscriptions.push(foam);
    profiler.stop();
    eventLoopMonitor.stop();

    const resources = foam.workspace.list();
    const noteCount = resources.filter(r => r.type === 'note').length;
    const attachmentCount = resources.filter(
      r => r.type === 'image' || r.type === 'attachment'
    ).length;
    Logger.info(`Loaded ${resources.length} resources`);
    Logger.info(
      profiler.formatReport({
        resources: `${resources.length} (${noteCount} notes, ${attachmentCount} attachments) from ${workspace.workspaceFolders.length} folder(s)`,
        'event loop': eventLoopMonitor.format(),
        memory: formatMemoryUsage(),
      })
    );

    // One broken feature must degrade that feature only, not abort the whole
    // activation (which would also skip extendMarkdownIt for every feature)
    const settled = await Promise.allSettled(featuresPromises);
    settled.forEach((result, i) => {
      if (result.status === 'rejected') {
        Logger.error(
          `Feature #${i} (${features[i].name || 'anonymous'}) failed to activate`,
          result.reason
        );
      }
    });
    const feats = settled
      .filter(
        (r): r is PromiseFulfilledResult<FoamFeatureResult | void> =>
          r.status === 'fulfilled'
      )
      .map(r => r.value)
      .filter((r): r is FoamFeatureResult => r != null);

    const featureTelemetry = feats.reduce(
      (acc, r) => ({ ...acc, ...r.telemetry }),
      {} as Record<string, string>
    );
    telemetry.trackConfigSnapshot();
    telemetry.trackWorkspaceStats(noteCount, attachmentCount, featureTelemetry);

    context.subscriptions.push(
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

    return {
      extendMarkdownIt: (md: markdownit) => {
        return feats.reduce((acc: markdownit, r) => {
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
