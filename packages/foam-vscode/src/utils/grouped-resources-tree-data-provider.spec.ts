import { FoamWorkspace } from '../core/model/workspace';
import { OPEN_COMMAND } from '../features/utility-commands';
import {
  GroupedResoucesConfigGroupBy,
  GroupedResourcesConfig,
} from '../settings';
import { createTestNote, strToUri } from '../test/test-utils';
import {
  DirectoryTreeItem,
  GroupedResourcesTreeDataProvider,
  UriTreeItem,
} from './grouped-resources-tree-data-provider';

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

  // Mock config
  const config: GroupedResourcesConfig = {
    exclude: ['path-exclude/**/*'],
    groupBy: GroupedResoucesConfigGroupBy.Folder,
  };

  it('should return the grouped resources as a folder tree', async () => {
    const provider = new GroupedResourcesTreeDataProvider(
      'length3',
      'note',
      config,
      [strToUri('')],
      () =>
        workspace
          .list()
          .filter(r => r.title.length === 3)
          .map(r => r.uri),
      uri => new UriTreeItem(uri)
    );
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
      'length3',
      'note',
      config,
      [strToUri('')],
      () =>
        workspace
          .list()
          .filter(r => r.title.length === 3)
          .map(r => r.uri),
      uri => new UriTreeItem(uri)
    );
    const directory = new DirectoryTreeItem(
      '/path',
      [new UriTreeItem(matchingNote1.uri)],
      'note'
    );
    const result = await provider.getChildren(directory);
    expect(result).toMatchObject([
      {
        collapsibleState: 0,
        label: 'ABC',
        description: '/path/ABC.md',
        command: { command: OPEN_COMMAND.command },
      },
    ]);
  });

  it('should return the flattened resources', async () => {
    const mockConfig = {
      ...config,
      groupBy: GroupedResoucesConfigGroupBy.Off,
    };
    const provider = new GroupedResourcesTreeDataProvider(
      'length3',
      'note',
      mockConfig,
      [strToUri('')],
      () =>
        workspace
          .list()
          .filter(r => r.title.length === 3)
          .map(r => r.uri),
      uri => new UriTreeItem(uri)
    );
    const result = await provider.getChildren();
    expect(result).toMatchObject([
      {
        collapsibleState: 0,
        label: matchingNote1.title,
        description: '/path/ABC.md',
        command: { command: OPEN_COMMAND.command },
      },
      {
        collapsibleState: 0,
        label: matchingNote2.title,
        description: '/path-bis/XYZ.md',
        command: { command: OPEN_COMMAND.command },
      },
    ]);
  });

  it('should return the grouped resources without exclusion', async () => {
    const mockConfig = { ...config, exclude: [] };
    const provider = new GroupedResourcesTreeDataProvider(
      'length3',
      'note',
      mockConfig,
      [strToUri('')],
      () =>
        workspace
          .list()
          .filter(r => r.title.length === 3)
          .map(r => r.uri),
      uri => new UriTreeItem(uri)
    );
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
      'length3',
      description,
      config,
      [strToUri('')],
      () =>
        workspace
          .list()
          .filter(r => r.title.length === 3)
          .map(r => r.uri),
      uri => new UriTreeItem(uri)
    );
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
