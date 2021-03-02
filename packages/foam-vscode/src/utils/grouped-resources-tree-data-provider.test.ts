import { FoamWorkspace, getTitle, Resource } from 'foam-core';
import {
  GroupedResoucesConfigGroupBy,
  GroupedResourcesConfig,
} from '../settings';
import { createTestNote, strToUri } from '../test/test-utils';
import {
  DirectoryTreeItem,
  GroupedResourcesTreeDataProvider,
} from './grouped-resources-tree-data-provider';

describe('GroupedResourcesTreeDataProvider', () => {
  const isMatch = (resource: Resource) => {
    return getTitle(resource).length === 3;
  };
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
    .set(notMatchingNote)
    .resolveLinks();

  const dataStore = { read: () => '' } as any;

  // Mock config
  const config: GroupedResourcesConfig = {
    exclude: ['path-exclude/**/*'],
    groupBy: GroupedResoucesConfigGroupBy.Folder,
  };

  it('should return the grouped resources as a folder tree', async () => {
    const provider = new GroupedResourcesTreeDataProvider(
      workspace,
      dataStore,
      'length3',
      'note',
      isMatch,
      config,
      [strToUri('')]
    );
    const result = await provider.getChildren();
    expect(result).toMatchObject([
      {
        collapsibleState: 1,
        label: '/path',
        description: '1 note',
        resources: [{ title: matchingNote1.title }],
      },
      {
        collapsibleState: 1,
        label: '/path-bis',
        description: '1 note',
        resources: [{ title: matchingNote2.title }],
      },
    ]);
  });

  it('should return the grouped resources in a directory', async () => {
    const provider = new GroupedResourcesTreeDataProvider(
      workspace,
      dataStore,
      'length3',
      'note',
      isMatch,
      config,
      [strToUri('')]
    );
    const directory = new DirectoryTreeItem(
      '/path',
      [matchingNote1 as any],
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
    const mockConfig = {
      ...config,
      groupBy: GroupedResoucesConfigGroupBy.Off,
    };
    const provider = new GroupedResourcesTreeDataProvider(
      workspace,
      dataStore,
      'length3',
      'note',
      isMatch,
      mockConfig,
      [strToUri('')]
    );
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
    const mockConfig = { ...config, exclude: [] };
    const provider = new GroupedResourcesTreeDataProvider(
      workspace,
      dataStore,
      'length3',
      'note',
      isMatch,
      mockConfig,
      [strToUri('')]
    );
    const result = await provider.getChildren();
    expect(result).toMatchObject([
      expect.anything(),
      expect.anything(),
      {
        collapsibleState: 1,
        label: '/path-exclude',
        description: '1 note',
        resources: [{ title: excludedPathNote.title }],
      },
    ]);
  });

  it('should dynamically set the description', async () => {
    const description = 'test description';
    const provider = new GroupedResourcesTreeDataProvider(
      workspace,
      dataStore,
      'length3',
      description,
      isMatch,
      config,
      [strToUri('')]
    );
    const result = await provider.getChildren();
    expect(result).toMatchObject([
      {
        collapsibleState: 1,
        label: '/path',
        description: `1 ${description}`,
        resources: expect.anything(),
      },
      {
        collapsibleState: 1,
        label: '/path-bis',
        description: `1 ${description}`,
        resources: expect.anything(),
      },
    ]);
  });
});
