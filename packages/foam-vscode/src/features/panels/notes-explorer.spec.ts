import * as vscode from 'vscode';
import { FoamGraph } from '../../core/model/graph';
import { FoamWorkspace } from '../../core/model/workspace';
import { MapBasedMemento, toVsCodeUri } from '../../utils/vsc-utils';
import { NotesProvider, findTreeItemByUri } from './notes-explorer';
import { ResourceTreeItem } from '../../utils/tree-view-utils';
import { Folder, FolderTreeItem } from './utils/folder-tree-provider';
import { createTestNote } from '../../test/test-utils';
import { Resource } from '../../core/model/note';

describe('NotesProvider', () => {
  it('findTreeItemByUri returns the correct tree item given a URI', async () => {
    const note = createTestNote({ uri: '/path/to/note.md' });
    const workspace = new FoamWorkspace().set(note);
    const graph = new FoamGraph(workspace);
    const state = new MapBasedMemento();
    const provider = new NotesProvider(workspace, graph, state);
    const anItem = await findTreeItemByUri(
      provider,
      vscode.Uri.parse('/a/path')
    );
    expect(anItem).toBeNull();
    const treeItem = await findTreeItemByUri(provider, toVsCodeUri(note.uri));
    expect(treeItem).not.toBeNull();
  });

  it('valueToPath returns the correct path of a resource as an array of strings', () => {
    const resource = createTestNote({ uri: '/path/to/note.md' });
    const workspace = new FoamWorkspace();
    const graph = new FoamGraph(workspace);
    const state = new MapBasedMemento();
    const provider = new NotesProvider(workspace, graph, state);
    const path = provider.valueToPath(resource);
    expect(path).toEqual(['path', 'to', 'note.md']);
  });

  it('creates a ResourceTreeItem with correct collapsible state and children', async () => {
    const workspace = new FoamWorkspace();
    const graph = new FoamGraph(workspace);
    const state = new MapBasedMemento();
    const provider = new NotesProvider(workspace, graph, state);
    const resource = createTestNote({ uri: '/path/to/note.md' });
    const tree = provider.createTree([resource], () => true);
    const parent = new FolderTreeItem(tree['path'] as Folder<Resource>, 'path');
    const treeItem = provider.createValueTreeItem(
      resource,
      parent
    ) as ResourceTreeItem;
    expect(treeItem).toBeInstanceOf(ResourceTreeItem);
    expect(treeItem.collapsibleState).toEqual(
      vscode.TreeItemCollapsibleState.None
    );
    expect(await treeItem.getChildren()).toEqual([]);
  });

  it('getValues returns the list of resources in the workspace', () => {
    const resource1 = createTestNote({ uri: '/path/to/note1.md' });
    const resource2 = createTestNote({ uri: '/path/to/note2.md' });
    const workspace = new FoamWorkspace().set(resource1).set(resource2);
    const graph = new FoamGraph(workspace);
    const state = new MapBasedMemento();
    const provider = new NotesProvider(workspace, graph, state);

    const values = provider.getValues();
    expect(values).toEqual([resource1, resource2]);
  });

  it('isValueType correctly identifies a Resource object', () => {
    const resource = createTestNote({ uri: '/path/to/note1.md' });
    const workspace = new FoamWorkspace();
    const graph = new FoamGraph(workspace);
    const state = new MapBasedMemento();
    const provider = new NotesProvider(workspace, graph, state);
    expect(provider.isValueType(resource)).toBe(true);
    expect(provider.isValueType({ foo: 'bar' } as any)).toBe(false);
  });
});
