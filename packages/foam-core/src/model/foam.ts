import { IDisposable } from '../common/lifecycle';
import { Event } from '../common/event';
import { IDataStore, IMatcher, IWatcher } from '../services/datastore';
import { URI } from './uri';
import { FoamWorkspace } from './workspace';
import { FoamGraph } from './graph';
import { ResourceParser } from './note';
import { ResourceProvider } from './provider';
import { FoamTags } from './tags';
import { Logger, withTiming, withTimingAsync } from '../utils/log';
import { GlobMatcher } from '../services/glob-matcher';
import { createMarkdownParser } from '../services/markdown-parser';
import { MarkdownResourceProvider } from '../services/markdown-provider';
import {
  AttachmentResourceProvider,
  defaultAttachmentExtensions,
} from '../services/attachment-provider';
import { ALWAYS_EXCLUDED } from '../vscode-settings';
import { getDirectory } from '../utils/path';

export interface Services {
  dataStore: IDataStore;
  parser: ResourceParser;
  matcher: IMatcher;
}

/**
 * How long to wait for file-create events to settle before refreshing the
 * matcher so that a burst of creates does not trigger one full workspace 
 * scan per create
 */
const CREATE_DEBOUNCE_MS = 100;

export interface Foam extends IDisposable {
  services: Services;
  workspace: FoamWorkspace;
  graph: FoamGraph;
  tags: FoamTags;
}

export interface BootstrapOptions {
  /** The workspace folders */
  roots: URI[];
  /** Lists, reads and writes the workspace's files */
  dataStore: IDataStore;
  /**
   * Which of the files the data store lists belong to the workspace.
   * Defaults to every file under `roots` except {@link ALWAYS_EXCLUDED}.
   */
  matcher?: IMatcher;
  /** Keeps the workspace in sync with changes; without one it is a snapshot */
  watcher?: IWatcher;
  /** Defaults to `createMarkdownParser()` */
  parser?: ResourceParser;
  /**
   * Defaults to `.md` notes, plus images and
   * {@link defaultAttachmentExtensions} as attachments
   */
  providers?: ResourceProvider[];
  /** Extension given to new notes. Defaults to `.md` */
  defaultExtension?: string;
  /** Level at which load timings are logged. Defaults to `info` */
  timingLogLevel?: 'debug' | 'info' | 'off';
  /** How many files are read at once while loading. Defaults to 256 */
  fetchConcurrency?: number;
}

export const bootstrap = async ({
  roots,
  dataStore,
  matcher = new GlobMatcher(
    roots.map(uri => ({ uri, include: ['**/*'], exclude: ALWAYS_EXCLUDED }))
  ),
  watcher,
  parser = createMarkdownParser(),
  providers = [
    new MarkdownResourceProvider(dataStore, parser),
    new AttachmentResourceProvider(defaultAttachmentExtensions),
  ],
  defaultExtension = '.md',
  timingLogLevel = 'info',
  fetchConcurrency = 256,
}: BootstrapOptions) => {
  const workspace = await withTimingAsync(
    () =>
      FoamWorkspace.fromProviders(
        roots,
        providers,
        dataStore,
        matcher,
        defaultExtension,
        fetchConcurrency
      ),
    ms => (timingLogLevel === 'off' ? null : Logger[timingLogLevel](`Workspace loaded in ${ms}ms`))
  );

  const graph = withTiming(
    () => FoamGraph.fromWorkspace(workspace, true),
    ms => (timingLogLevel === 'off' ? null : Logger[timingLogLevel](`Graph loaded in ${ms}ms`))
  );

  const tags = withTiming(
    () => FoamTags.fromWorkspace(workspace, true),
    ms => (timingLogLevel === 'off' ? null : Logger[timingLogLevel](`Tags loaded in ${ms}ms`))
  );

  const subscriptions: IDisposable[] = [];

  if (watcher) {
    // A read requested before its file, or a folder above it, is deleted must
    // not put the resource back: by the time it runs, the path may hold a
    // newer file, whose creation and deletion the watcher may never report.
    // Requests and deletions take turns from one counter; deletions are
    // recorded only while a read is pending.
    let turn = 0;
    let pendingReads = 0;
    const deletedAt = new Map<string, number>();
    const recordDeletion = (path: string) => {
      if (pendingReads > 0) {
        deletedAt.set(path.replace(/\/$/, ''), ++turn);
      }
    };
    const requestRead = () => {
      pendingReads++;
      return ++turn;
    };
    const settleRead = () => {
      if (--pendingReads === 0) {
        deletedAt.clear();
      }
    };
    const isDeletedSince = (uri: URI, requestedAt: number) => {
      let path = uri.path;
      for (;;) {
        if ((deletedAt.get(path) ?? 0) > requestedAt) {
          return true;
        }
        const parent = getDirectory(path);
        if (parent === path) {
          return false;
        }
        path = parent;
      }
    };
    subscriptions.push(
      workspace.onDidDelete(resource => recordDeletion(resource.uri.path))
    );
    const fetchAndSetUnlessDeleted = async (uri: URI, requestedAt: number) => {
      try {
        const resource = await workspace.fetch(uri);
        if (resource && !isDeletedSince(uri, requestedAt)) {
          workspace.set(resource);
        }
      } finally {
        settleRead();
      }
    };

    // Serialize change handling per URI: two rapid changes to the same file
    // would otherwise race on their reads, and the workspace would keep
    // whichever read completed LAST, not the latest content
    const pendingChanges = new Map<string, Promise<unknown>>();
    subscriptions.push(
      watcher.onDidChange(uri => {
        if (matcher.isMatch(uri)) {
          const key = uri.toString();
          const requestedAt = requestRead();
          const next = (pendingChanges.get(key) ?? Promise.resolve()).then(() =>
            fetchAndSetUnlessDeleted(uri, requestedAt)
          );
          pendingChanges.set(key, next);
          next.finally(() => {
            if (pendingChanges.get(key) === next) {
              pendingChanges.delete(key);
            }
          });
        }
      })
    );

    // Coalesce a burst of creates into a single refresh, then
    // process every accumulated URI. (issue #1668)
    const onDidCreateBatch = Event.debounce<
      URI,
      { uri: URI; requestedAt: number }[]
    >(
      watcher.onDidCreate,
      (batch, uri) => [...(batch ?? []), { uri, requestedAt: requestRead() }],
      CREATE_DEBOUNCE_MS
    );
    subscriptions.push(
      onDidCreateBatch(async creates => {
        await matcher.refresh();
        for (const { uri, requestedAt } of creates) {
          if (matcher.isMatch(uri)) {
            await fetchAndSetUnlessDeleted(uri, requestedAt);
          } else {
            settleRead();
          }
        }
      })
    );

    subscriptions.push(
      watcher.onDidDelete(uri => {
        // A watcher may report a folder deleted, moved or renamed as one
        // event, without its files
        const folderPrefix = uri.path.endsWith('/') ? uri.path : uri.path + '/';
        // A read of a file not indexed yet has no resource for the workspace
        // to delete, so nothing else records it
        recordDeletion(uri.path);
        if (workspace.delete(uri)) {
          return;
        }
        // Not a resource, so possibly a folder
        for (const resource of workspace.list()) {
          if (resource.uri.path.startsWith(folderPrefix)) {
            workspace.delete(resource.uri);
          }
        }
      })
    );
  }

  const foam: Foam = {
    workspace,
    graph,
    tags,
    services: {
      parser,
      dataStore,
      matcher,
    },
    dispose: () => {
      subscriptions.forEach(s => s.dispose());
      tags.dispose();
      graph.dispose();
      workspace.dispose();
    },
  };

  return foam;
};
