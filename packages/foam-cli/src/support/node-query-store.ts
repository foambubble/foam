import { AlwaysIncludeMatcher, QueryStore, URI } from '@foam/core';
import { NodeFileDataStore } from './filesystem';

/**
 * Node-backed {@link QueryStore} for `.foam/queries/<id>.yaml`. Built on
 * {@link NodeFileDataStore} with an unrestricted matcher so the queries
 * directory isn't filtered out by the workspace's note-only matcher.
 */
export function createNodeQueryStore(workspaceRoot: URI): QueryStore {
  const dataStore = new NodeFileDataStore(
    workspaceRoot.toFsPath(),
    [],
    new AlwaysIncludeMatcher()
  );
  return new QueryStore(dataStore, workspaceRoot);
}
