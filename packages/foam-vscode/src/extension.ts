import {
  workspace,
  ExtensionContext,
  window,
  commands,
  RelativePattern,
  Uri,
} from 'vscode';
import { MarkdownResourceProvider } from './core/services/markdown-provider';
import { bootstrap } from './core/model/foam';
import { URI } from './core/model/uri';
import {
  FileListBasedMatcher,
  GenericDataStore,
} from './core/services/datastore';
import { Logger } from './core/utils/log';

import { features } from './features';
import { VsCodeOutputLogger, exposeLogger } from './services/logging';
import { getIgnoredFilesSetting } from './settings';
import { fromVsCodeUri, toVsCodeUri } from './utils/vsc-utils';
import { AttachmentResourceProvider } from './core/services/attachment-provider';
import { VsCodeWatcher } from './services/watcher';
import { createMarkdownParser } from './core/services/markdown-parser';
import VsCodeBasedParserCache from './services/cache';

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
    const excludePatterns = new Map<string, string[]>();
    workspace.workspaceFolders.forEach(f => excludePatterns.set(f.name, []));

    const excludes = getIgnoredFilesSetting().map(g => g.toString());
    for (const exclude of excludes) {
      let tokens = exclude.split('/');
      const matchesFolder = workspace.workspaceFolders.find(
        f => f.name === tokens[0]
      );
      if (matchesFolder) {
        excludePatterns.get(tokens[0]).push(tokens.slice(1).join('/'));
      } else {
        for (const [key, value] of excludePatterns.entries()) {
          value.push(exclude);
        }
      }
    }

    Logger.info('Loading from directories:');
    for (const folder of workspace.workspaceFolders) {
      Logger.info('- ' + folder.uri.fsPath);
      Logger.info('  Include: **/*');
      Logger.info('  Exclude: ' + excludePatterns.get(folder.name).join(','));
    }

    const listFiles = async () => {
      let files: Uri[] = [];
      for (const folder of workspace.workspaceFolders) {
        const uris = await workspace.findFiles(
          new RelativePattern(folder.uri.path, '**/*'),
          new RelativePattern(
            folder.uri.path,
            `{${excludePatterns.get(folder.name).join(',')}}`
          )
        );
        files = [...files, ...uris];
      }

      return files.map(fromVsCodeUri);
    };

    const readFile = async (uri: URI) =>
      (await workspace.fs.readFile(toVsCodeUri(uri))).toString();

    const dataStore = new GenericDataStore(listFiles, readFile);

    const files = await dataStore.list();

    const matcher = new FileListBasedMatcher(files, listFiles);
    const watcher = new VsCodeWatcher(
      workspace.createFileSystemWatcher('**/*')
    );
    const parserCache = new VsCodeBasedParserCache(context);
    const parser = createMarkdownParser([], parserCache);

    const markdownProvider = new MarkdownResourceProvider(dataStore, parser);
    const attachmentProvider = new AttachmentResourceProvider();

    const foamPromise = bootstrap(matcher, watcher, dataStore, parser, [
      markdownProvider,
      attachmentProvider,
    ]);

    // Load the features
    const resPromises = features.map(f => f.activate(context, foamPromise));

    const foam = await foamPromise;
    Logger.info(`Loaded ${foam.workspace.list().length} resources`);

    context.subscriptions.push(
      foam,
      watcher,
      markdownProvider,
      attachmentProvider,
      commands.registerCommand('foam-vscode.clear-cache', () =>
        parserCache.clear()
      )
    );

    const res = (await Promise.all(resPromises)).filter(r => r != null);

    return {
      extendMarkdownIt: (md: markdownit) => {
        return res.reduce((acc: markdownit, r: any) => {
          return r.extendMarkdownIt ? r.extendMarkdownIt(acc) : acc;
        }, md);
      },
    };
  } catch (e) {
    Logger.error('An error occurred while bootstrapping Foam', e);
    window.showErrorMessage(
      `An error occurred while bootstrapping Foam. ${e.stack}`
    );
  }
}
