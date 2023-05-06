import { FoamWorkspace } from '../../../core/model/workspace';
import {
  AlwaysIncludeMatcher,
  SubstringExcludeMatcher,
} from '../../../core/services/datastore';
import { createTestNote } from '../../../test/test-utils';
import {
  DirectoryTreeItem,
  GroupedResourcesTreeDataProvider,
} from './grouped-resources-tree-data-provider';
import { ResourceTreeItem, UriTreeItem } from './tree-view-utils';
import { randomString } from '../../../test/test-utils';
import { MapBasedMemento } from '../../../utils/vsc-utils';

const testMatcher = new SubstringExcludeMatcher('path-exclude');

describe('GroupedResourcesTreeDataProvider', () => {
  const matchingNote1 = createTestNote({ uri: '/path/ABC.md', title: 'ABC' });
  const matchingNote2 = createTestNote({
    uri: '/path-bis/XYZ.md',
    title: 'XYZ',
  });
  const excludedPathNote = createTestNote({
    uri: '/path-exclude/HIJ.m',
    title: 'HIJ',
  });
  const notMatchingNote = createTestNote({
    uri: '/path-bis/ABCDEFG.md',
    title: 'ABCDEFG',
  });

  const workspace = new FoamWorkspace()
    .set(matchingNote1)
    .set(matchingNote2)
    .set(excludedPathNote)
    .set(notMatchingNote);

  it('should return the grouped resources as a folder tree', async () => {
    const provider = new GroupedResourcesTreeDataProvider(
      randomString(),
      'note',
      new MapBasedMemento(),
      testMatcher,
      () =>
        workspace
          .list()
          .filter(r => r.title.length === 3)
          .map(r => r.uri),
      uri => new UriTreeItem(uri)
    );
    provider.groupBy.update('folder');
    provider.refresh();
    const result = await provider.getChildren();
    expect(result).toMatchObject([
      {
        collapsibleState: 1,
        label: '/path',
        description: '1 note',
        children: [new UriTreeItem(matchingNote1.uri)],
      },
      {
        collapsibleState: 1,
        label: '/path-bis',
        description: '1 note',
        children: [new UriTreeItem(matchingNote2.uri)],
      },
    ]);
  });

  it('should return the grouped resources in a directory', async () => {
    const provider = new GroupedResourcesTreeDataProvider(
      randomString(),
      'note',
      new MapBasedMemento(),
      testMatcher,
      () =>
        workspace
          .list()
          .filter(r => r.title.length === 3)
          .map(r => r.uri),
      uri => new ResourceTreeItem(workspace.get(uri), workspace)
    );
    provider.groupBy.update('folder');
    provider.refresh();

    const directory = new DirectoryTreeItem(
      '/path',
      [new ResourceTreeItem(matchingNote1, workspace)],
      'note'
    );
    const result = await provider.getChildren(directory);
    expect(result).toMatchObject([
      {
        collapsibleState: 0,
        label: 'ABC',
        description: '/path/ABC.md',
        command: { command: 'vscode.open' },
      },
    ]);
  });

  it('should return the flattened resources', async () => {
    const provider = new GroupedResourcesTreeDataProvider(
      randomString(),
      'note',
      new MapBasedMemento(),
      testMatcher,
      () =>
        workspace
          .list()
          .filter(r => r.title.length === 3)
          .map(r => r.uri),
      uri => new ResourceTreeItem(workspace.get(uri), workspace)
    );
    provider.groupBy.update('off');
    provider.refresh();

    const result = await provider.getChildren();
    expect(result).toMatchObject([
      {
        collapsibleState: 0,
        label: matchingNote1.title,
        description: '/path/ABC.md',
        command: { command: 'vscode.open' },
      },
      {
        collapsibleState: 0,
        label: matchingNote2.title,
        description: '/path-bis/XYZ.md',
        command: { command: 'vscode.open' },
      },
    ]);
  });

  it('should return the grouped resources without exclusion', async () => {
    const provider = new GroupedResourcesTreeDataProvider(
      randomString(),
      'note',
      new MapBasedMemento(),
      new AlwaysIncludeMatcher(),
      () =>
        workspace
          .list()
          .filter(r => r.title.length === 3)
          .map(r => r.uri),
      uri => new UriTreeItem(uri)
    );
    provider.groupBy.update('folder');
    provider.refresh();

    const result = await provider.getChildren();
    expect(result).toMatchObject([
      expect.anything(),
      expect.anything(),
      {
        collapsibleState: 1,
        label: '/path-exclude',
        description: '1 note',
        children: [new UriTreeItem(excludedPathNote.uri)],
      },
    ]);
  });

  it('should dynamically set the description', async () => {
    const description = 'test description';
    const provider = new GroupedResourcesTreeDataProvider(
      randomString(),
      description,
      new MapBasedMemento(),
      testMatcher,
      () =>
        workspace
          .list()
          .filter(r => r.title.length === 3)
          .map(r => r.uri),
      uri => new UriTreeItem(uri)
    );
    provider.groupBy.update('folder');
    provider.refresh();
    const result = await provider.getChildren();
    expect(result).toMatchObject([
      {
        collapsibleState: 1,
        label: '/path',
        description: `1 ${description}`,
        children: expect.anything(),
      },
      {
        collapsibleState: 1,
        label: '/path-bis',
        description: `1 ${description}`,
        children: expect.anything(),
      },
    ]);
  });
});
