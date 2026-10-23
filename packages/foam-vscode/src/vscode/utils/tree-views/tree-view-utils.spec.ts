/* @unit-ready */
import { commands } from 'vscode';
import { createMarkdownParser, FoamGraph, URI } from '@foam/core';
import {
  createTestWorkspace,
  createNoteFromMarkdown,
  InMemoryDataStore,
} from '../../../test/test-utils';
import {
  closeEditors,
  createFile,
  getActiveTabViewType,
  MARKDOWN_EDITOR_VIEW_TYPE,
  withMarkdownEditorAssociation,
} from '../../../test/test-utils-vscode';
import { deleteFile } from '../../services/editor';
import {
  createConnectionItemsForResource,
  ResourceTreeItem,
} from './tree-view-utils';

class CountingDataStore extends InMemoryDataStore {
  public readCount = 0;

  async read(uri: URI): Promise<string | null> {
    this.readCount++;
    return super.read(uri);
  }
}

/**
 * A workspace where `target.md` has four backlinks: three from `source-a.md`
 * (same file, so its content should only be read once) and one from
 * `source-b.md`.
 */
const createWorkspaceWithConnections = () => {
  const dataStore = new CountingDataStore();
  const workspace = createTestWorkspace([URI.file('/')], dataStore);

  const sourceAContent = [
    'First [[target]]',
    'Second [[target]]',
    'Third [[target]]',
  ].join('\n');
  const sourceBContent = 'Another note linking to [[target]]';
  const targetContent = '# Target';

  const sourceA = createNoteFromMarkdown('/source-a.md', sourceAContent);
  const sourceB = createNoteFromMarkdown('/source-b.md', sourceBContent);
  const target = createNoteFromMarkdown('/target.md', targetContent);

  dataStore.set(sourceA.uri, sourceAContent);
  dataStore.set(sourceB.uri, sourceBContent);
  dataStore.set(target.uri, targetContent);

  workspace.set(sourceA);
  workspace.set(sourceB);
  workspace.set(target);

  const graph = FoamGraph.fromWorkspace(workspace);
  return { dataStore, workspace, graph, target, sourceA };
};

describe('createConnectionItemsForResource', () => {
  it('creates one item per connection, with the source line as label', async () => {
    const { workspace, graph, target } = createWorkspaceWithConnections();

    const items = await createConnectionItemsForResource(
      workspace,
      graph,
      target.uri
    );

    expect(items.length).toEqual(4);
    const labels = items.map(item => item.label);
    expect(labels).toContain('1: First [[target]]');
    expect(labels).toContain('2: Second [[target]]');
    expect(labels).toContain('3: Third [[target]]');
  });

  it('reads each unique source file only once per refresh', async () => {
    const { dataStore, workspace, graph, target } =
      createWorkspaceWithConnections();

    await createConnectionItemsForResource(workspace, graph, target.uri);

    // three connections from source-a.md must share one read; source-b.md
    // accounts for the other
    expect(dataStore.readCount).toEqual(2);
  });

  it('does not read files again on a subsequent refresh when nothing changed', async () => {
    const { dataStore, workspace, graph, target } =
      createWorkspaceWithConnections();

    await createConnectionItemsForResource(workspace, graph, target.uri);
    const readsAfterFirstRefresh = dataStore.readCount;

    await createConnectionItemsForResource(workspace, graph, target.uri);

    expect(dataStore.readCount).toEqual(readsAfterFirstRefresh);
  });

  it('reads a file again after it has been updated in the workspace', async () => {
    const { dataStore, workspace, graph, target, sourceA } =
      createWorkspaceWithConnections();

    await createConnectionItemsForResource(workspace, graph, target.uri);
    const readsAfterFirstRefresh = dataStore.readCount;

    const updatedContent = [
      'A new first line',
      'First [[target]]',
      'Second [[target]]',
      'Third [[target]]',
    ].join('\n');
    dataStore.set(sourceA.uri, updatedContent);
    workspace.set(createNoteFromMarkdown('/source-a.md', updatedContent));

    await createConnectionItemsForResource(workspace, graph, target.uri);

    // only the changed file is re-read, the other one is still fresh
    expect(dataStore.readCount).toEqual(readsAfterFirstRefresh + 1);
  });
});

// Every Foam tree view — backlinks, orphans, tags, placeholders, smart folders
// — opens a note through the item's `vscode.open` command, so the workbench
// resolves `workbench.editorAssociations` for it.
// See: https://github.com/foambubble/foam/issues/1742
describe('ResourceTreeItem activation', () => {
  const activate = (item: ResourceTreeItem) =>
    commands.executeCommand(item.command.command, ...item.command.arguments);

  const treeItemFor = async (path: string[]) => {
    const file = await createFile('# A note', path);
    const resource = createMarkdownParser([]).parse(file.uri, file.content);
    const workspace = createTestWorkspace().set(resource);
    return { item: new ResourceTreeItem(resource, workspace), uri: file.uri };
  };

  afterEach(async () => {
    await closeEditors();
  });

  it('opens the note in the editor associated with Markdown', async () => {
    const { item, uri } = await treeItemFor(['tree-view', 'associated.md']);

    await withMarkdownEditorAssociation(async () => {
      await activate(item);

      expect(getActiveTabViewType()).toEqual(MARKDOWN_EDITOR_VIEW_TYPE);
    });

    await deleteFile(uri);
  });

  it('opens the note in the text editor when nothing is associated with Markdown', async () => {
    const { item, uri } = await treeItemFor(['tree-view', 'plain.md']);

    await activate(item);

    expect(getActiveTabViewType()).toBeUndefined();

    await deleteFile(uri);
  });
});
