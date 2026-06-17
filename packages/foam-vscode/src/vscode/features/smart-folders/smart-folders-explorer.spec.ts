/* @unit-ready */
import { FoamGraph, URI } from '@foam/core';
import { MapBasedMemento } from '../../utils/vsc-utils';
import { createTestNote, createTestWorkspace } from '../../../test/test-utils';
import { getUriInWorkspace } from '../../../test/test-utils-vscode';
import {
  SmartFolderErrorTreeItem,
  SmartFolderTreeItem,
  SmartFoldersProvider,
  buildFolderTree,
} from './smart-folders-explorer';
import { SmartFolderStorage } from './smart-folder-storage';
import { ResourceTreeItem } from '../../utils/tree-views/tree-view-utils';
import { FolderTreeItem } from '../../utils/tree-views/folder-tree-provider';

/**
 * A storage stub that bypasses the file system entirely. The tree view only
 * depends on `list()`, so this is enough to exercise it.
 */
function stubStorage(
  queries: { id: string; name: string; filter: unknown; errors?: string[] }[]
): SmartFolderStorage {
  const list = queries.map(q => ({
    query: {
      id: q.id,
      name: q.name,
      descriptor: { filter: q.filter as any },
    },
    uri: getUriInWorkspace(`.foam/queries/${q.id}.yaml`),
    errors: q.errors ?? [],
  }));
  return {
    list: () => list,
    onDidUpdate: () => ({ dispose: () => {} }),
    dispose: () => {},
  } as unknown as SmartFolderStorage;
}

describe('SmartFoldersProvider', () => {
  it('lists smart folders at the top level with note counts', async () => {
    const rootUri = getUriInWorkspace('seed.md');
    const ws = createTestWorkspace();
    const noteWip = createTestNote({
      root: rootUri,
      uri: './work-1.md',
      tags: ['wip'],
    });
    const noteDone = createTestNote({
      root: rootUri,
      uri: './done.md',
      tags: ['done'],
    });
    ws.set(noteWip).set(noteDone);
    const graph = FoamGraph.fromWorkspace(ws, true);

    const provider = new SmartFoldersProvider(
      ws,
      graph,
      stubStorage([{ id: 'wip', name: 'In Progress', filter: '#wip' }]),
      new MapBasedMemento(),
      () => false,
      false
    );

    const top = await provider.getChildren();
    expect(top).toHaveLength(1);
    expect(top[0]).toBeInstanceOf(SmartFolderTreeItem);
    expect((top[0] as SmartFolderTreeItem).loaded.query.name).toBe(
      'In Progress'
    );
    expect((top[0] as SmartFolderTreeItem).uris).toHaveLength(1);
    expect((top[0] as SmartFolderTreeItem).description).toBe('1');

    graph.dispose();
    ws.dispose();
    provider.dispose();
  });

  it('expands a smart folder into matching notes in flat mode', async () => {
    const rootUri = getUriInWorkspace('seed.md');
    const ws = createTestWorkspace();
    const a = createTestNote({
      root: rootUri,
      uri: './a.md',
      tags: ['wip'],
    });
    const b = createTestNote({
      root: rootUri,
      uri: './nested/b.md',
      tags: ['wip'],
    });
    ws.set(a).set(b);
    const graph = FoamGraph.fromWorkspace(ws, true);

    const provider = new SmartFoldersProvider(
      ws,
      graph,
      stubStorage([{ id: 'wip', name: 'WIP', filter: '#wip' }]),
      new MapBasedMemento(),
      () => false,
      false
    );
    provider.groupBy.update('off');

    const [folder] = (await provider.getChildren()) as SmartFolderTreeItem[];
    const children = (await provider.getChildren(
      folder
    )) as ResourceTreeItem[];
    expect(children).toHaveLength(2);
    const paths = children.map(c => c.resource.uri.path).sort();
    expect(paths).toEqual([a.uri.path, b.uri.path].sort());

    graph.dispose();
    ws.dispose();
    provider.dispose();
  });

  it('groups children by folder when group-by is set to folder', async () => {
    const rootUri = getUriInWorkspace('seed.md');
    const workspaceRoot = rootUri.getDirectory();
    const ws = createTestWorkspace([workspaceRoot]);
    const a = createTestNote({
      root: rootUri,
      uri: './a.md',
      tags: ['wip'],
    });
    const b = createTestNote({
      root: rootUri,
      uri: './nested/b.md',
      tags: ['wip'],
    });
    ws.set(a).set(b);
    const graph = FoamGraph.fromWorkspace(ws, true);

    const provider = new SmartFoldersProvider(
      ws,
      graph,
      stubStorage([{ id: 'wip', name: 'WIP', filter: '#wip' }]),
      new MapBasedMemento(),
      () => false,
      false
    );
    provider.groupBy.update('folder');

    const [folder] = (await provider.getChildren()) as SmartFolderTreeItem[];
    const children = await provider.getChildren(folder);
    // One leaf at root (a.md) and one folder node (nested/) — order: folders
    // are returned in sorted-key order alongside leaves.
    const folders = children.filter(
      c => c instanceof FolderTreeItem
    ) as FolderTreeItem<URI>[];
    const leaves = children.filter(c => c instanceof ResourceTreeItem);
    expect(folders).toHaveLength(1);
    expect(leaves).toHaveLength(1);

    graph.dispose();
    ws.dispose();
    provider.dispose();
  });

  it('surfaces parse errors as SmartFolderErrorTreeItem', async () => {
    const ws = createTestWorkspace();
    const graph = FoamGraph.fromWorkspace(ws, true);

    const provider = new SmartFoldersProvider(
      ws,
      graph,
      stubStorage([
        {
          id: 'broken',
          name: 'Broken',
          filter: '#whatever',
          errors: ['Unknown field "bogus"'],
        },
      ]),
      new MapBasedMemento(),
      () => false,
      false
    );

    const top = await provider.getChildren();
    expect(top).toHaveLength(1);
    expect(top[0]).toBeInstanceOf(SmartFolderErrorTreeItem);
    expect((top[0] as SmartFolderErrorTreeItem).tooltip).toContain('bogus');

    graph.dispose();
    ws.dispose();
    provider.dispose();
  });

  it('returns an empty result when the query fails to execute and the tree stays usable', async () => {
    const ws = createTestWorkspace();
    const graph = FoamGraph.fromWorkspace(ws, true);

    const provider = new SmartFoldersProvider(
      ws,
      graph,
      // Invalid filter — the engine returns warnings, not a throw,
      // but the result list should still be sensible.
      stubStorage([
        { id: 'bad-regex', name: 'Bad', filter: '/[unbalanced/' },
      ]),
      new MapBasedMemento(),
      () => false,
      false
    );

    const top = await provider.getChildren();
    expect(top).toHaveLength(1);
    expect((top[0] as SmartFolderTreeItem).uris).toHaveLength(0);

    graph.dispose();
    ws.dispose();
    provider.dispose();
  });
});

describe('buildFolderTree', () => {
  it('groups uris by their workspace-relative directory', () => {
    const workspaceRoot = getUriInWorkspace('seed.md').getDirectory();
    const ws = createTestWorkspace([workspaceRoot]);
    const root = buildFolderTree(
      [
        getUriInWorkspace('a.md'),
        getUriInWorkspace('sub/b.md'),
        getUriInWorkspace('sub/c.md'),
        getUriInWorkspace('sub/deep/d.md'),
      ],
      ws
    );
    expect(Object.keys(root.children).sort()).toEqual(['a.md', 'sub']);
    expect(Object.keys(root.children.sub.children).sort()).toEqual([
      'b.md',
      'c.md',
      'deep',
    ]);
    expect(Object.keys(root.children.sub.children.deep.children)).toEqual([
      'd.md',
    ]);
    ws.dispose();
  });
});
