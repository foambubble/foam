import { GenericDataStore, IDataStore } from '../services/datastore';
import { URI } from '../model/uri';
import {
  Query,
  filenameFromQueryId,
  idFromQueryFilename,
  parseQuery,
  serializeQuery,
} from './saved';

/** Workspace-relative directory where saved queries live. */
export const QUERIES_DIR = '.foam/queries';

/**
 * Workspace-relative glob selecting every saved query file. Exported for
 * consumers (e.g. a VS Code `FileSystemWatcher`) that need the pattern
 * eagerly — everything else should go through {@link QueryStore}.
 */
export const QUERIES_GLOB = `${QUERIES_DIR}/*.{yaml,yml}`;

export interface LoadedQuery {
  query: Query;
  uri: URI;
  errors: string[];
}

/**
 * Reads and writes saved queries against any {@link IDataStore}.
 *
 * The datastore must list YAML files under `.foam/queries/`. The general
 * Foam workspace datastore is typically scoped to notes (`**\/*.md`) and
 * won't see them — consumers should pass a queries-scoped datastore (e.g.
 * one built via {@link createQueryDataStore}) or one whose `list()` covers
 * the directory (e.g. `InMemoryDataStore`).
 *
 * Stateless: each call hits the datastore. Tree views and other consumers
 * that re-read frequently should layer their own cache on top.
 */
export class QueryStore {
  constructor(
    private readonly dataStore: IDataStore,
    private readonly workspaceRoot: URI
  ) {}

  /** The canonical file URI for a saved query with the given id. */
  getFileUri(id: string): URI {
    return this.workspaceRoot.joinPath(QUERIES_DIR, filenameFromQueryId(id));
  }

  /** Returns true if `uri` points at a YAML file under the queries directory. */
  isQueryFile(uri: URI): boolean {
    const dir = this.workspaceRoot.joinPath(QUERIES_DIR).path;
    return uri.path.startsWith(dir + '/') && /\.ya?ml$/i.test(uri.path);
  }

  /** Load every parseable query file; unparsable ones are silently skipped. */
  async loadAll(): Promise<LoadedQuery[]> {
    const uris = await this.listQueryFiles();
    const loaded = await Promise.all(uris.map(uri => this.load(uri)));
    return loaded.filter((q): q is LoadedQuery => q !== undefined);
  }

  /**
   * Returns `undefined` when the file is unreadable or fails to parse.
   * Soft parse warnings (e.g. unknown fields) come back in `errors`
   * alongside a successful load.
   */
  async load(uri: URI): Promise<LoadedQuery | undefined> {
    const content = await this.dataStore.read(uri);
    if (content == null) {
      return undefined;
    }
    const id = idFromQueryFilename(uri.getName());
    const result = parseQuery(id, content);
    if (!result.query) {
      return undefined;
    }
    return { query: result.query, uri, errors: result.errors };
  }

  /** Serialize and write a query to its canonical location. */
  async save(query: Query): Promise<URI> {
    const uri = this.getFileUri(query.id);
    const yaml = serializeQuery(query);
    await this.dataStore.write(uri, yaml);
    return uri;
  }

  /** Delete a saved query by id. No-op if the file doesn't exist. */
  async delete(id: string): Promise<void> {
    const uri = this.getFileUri(id);
    if (await this.dataStore.exists(uri)) {
      await this.dataStore.delete(uri);
    }
  }

  /** Returns true if a query file with this id exists on disk. */
  async exists(id: string): Promise<boolean> {
    return this.dataStore.exists(this.getFileUri(id));
  }

  // No defensive filter: IDataStore.list is contractually required to honor
  // the pattern, so what comes back is already exactly the query files.
  private async listQueryFiles(): Promise<URI[]> {
    return this.dataStore.list(QUERIES_GLOB);
  }
}

/**
 * IO primitives that {@link createQueryDataStore} composes into an
 * {@link IDataStore}. `list` receives a workspace-relative glob and must
 * honor it — callers forward it to their native glob primitive
 * (`vscode.workspace.findFiles`, `fast-glob`, etc.).
 */
export interface QueryDataStoreOps {
  list: (pattern: string) => Promise<URI[]>;
  read: (uri: URI) => Promise<string>;
  write: (uri: URI, content: string) => Promise<void>;
  delete: (uri: URI) => Promise<void>;
  exists: (uri: URI) => Promise<boolean>;
  move?: (from: URI, to: URI) => Promise<void>;
}

export function createQueryDataStore(ops: QueryDataStoreOps): IDataStore {
  // Default a bare `list()` to the queries glob so the store does something
  // sensible without an explicit pattern.
  const listFiles = async (pattern?: string): Promise<URI[]> => {
    return ops.list(pattern ?? QUERIES_GLOB);
  };
  return new GenericDataStore(
    listFiles,
    ops.read,
    ops.write,
    ops.delete,
    ops.move,
    ops.exists
  );
}
