import { workspace, ExtensionContext, window, FileSystemWatcher } from 'vscode';
import { MarkdownResourceProvider } from './core/services/markdown-provider';
import { bootstrap } from './core/model/foam';
import { URI } from './core/model/uri';
import { FileDataStore, Matcher } from './core/services/datastore';
import { Logger } from './core/utils/log';

import { features } from './features';
import { VsCodeOutputLogger, exposeLogger } from './services/logging';
import { getIgnoredFilesSetting } from './settings';
import { fromVsCodeUri, toVsCodeUri } from './utils/vsc-utils';
import { AttachmentResourceProvider } from './core/services/attachment-provider';
import { VsCodeWatcher } from './services/watcher';

export async function activate(context: ExtensionContext) {
  const logger = new VsCodeOutputLogger();
  Logger.setDefaultLogger(logger);
  exposeLogger(context, logger);

  try {
    Logger.info('Starting Foam');

    // Prepare Foam
    const readFile = async (uri: URI) =>
      (await workspace.fs.readFile(toVsCodeUri(uri))).toString();
    const dataStore = new FileDataStore(readFile);
    const matcher = new Matcher(
      workspace.workspaceFolders.map(dir => fromVsCodeUri(dir.uri)),
      ['**/*'],
      getIgnoredFilesSetting().map(g => g.toString())
    );
    const watcher = new VsCodeWatcher(
      workspace.createFileSystemWatcher('**/*')
    );
    const markdownProvider = new MarkdownResourceProvider(
      matcher,
      dataStore,
      watcher
    );
    const attachmentProvider = new AttachmentResourceProvider(
      matcher,
      dataStore,
      watcher
    );

    const foamPromise = bootstrap(matcher, dataStore, [
      markdownProvider,
      attachmentProvider,
    ]);

    // Load the features
    const resPromises = features.map(f => f.activate(context, foamPromise));

    const foam = await foamPromise;
    Logger.info(`Loaded ${foam.workspace.list().length} notes`);
    context.subscriptions.push(
      foam,
      watcher,
      markdownProvider,
      attachmentProvider
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
