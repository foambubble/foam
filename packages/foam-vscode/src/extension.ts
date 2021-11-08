import { workspace, ExtensionContext, window } from 'vscode';
import { MarkdownResourceProvider } from './core/markdown-provider';
import { bootstrap } from './core/model/foam';
import { FileDataStore, Matcher } from './core/services/datastore';
import { Logger } from './core/utils/log';

import { features } from './features';
import { VsCodeOutputLogger, exposeLogger } from './services/logging';
import { getIgnoredFilesSetting } from './settings';
import { fromVsCodeUri } from './utils/vsc-utils';

export async function activate(context: ExtensionContext) {
  const logger = new VsCodeOutputLogger();
  Logger.setDefaultLogger(logger);
  exposeLogger(context, logger);

  try {
    Logger.info('Starting Foam');

    // Prepare Foam
    const dataStore = new FileDataStore();
    const matcher = new Matcher(
      workspace.workspaceFolders.map(dir => fromVsCodeUri(dir.uri)),
      ['**/*'],
      getIgnoredFilesSetting().map(g => g.toString())
    );
    const markdownProvider = new MarkdownResourceProvider(matcher, triggers => {
      const watcher = workspace.createFileSystemWatcher('**/*');
      return [
        watcher.onDidChange(uri => triggers.onDidChange(fromVsCodeUri(uri))),
        watcher.onDidCreate(uri => triggers.onDidCreate(fromVsCodeUri(uri))),
        watcher.onDidDelete(uri => triggers.onDidDelete(fromVsCodeUri(uri))),
        watcher,
      ];
    });

    const foamPromise = bootstrap(matcher, dataStore, [markdownProvider]);

    // Load the features
    const resPromises = features.map(f => f.activate(context, foamPromise));

    const foam = await foamPromise;
    Logger.info(`Loaded ${foam.workspace.list().length} notes`);
    context.subscriptions.push(foam, markdownProvider);

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
