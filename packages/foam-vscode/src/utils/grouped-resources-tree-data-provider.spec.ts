import { Memento } from 'vscode';
import { FoamWorkspace } from '../core/model/workspace';
import {
  AlwaysIncludeMatcher,
  SubstringExcludeMatcher,
} from '../core/services/datastore';
import { createTestNote } from '../test/test-utils';
import {
  DirectoryTreeItem,
  GroupedResourcesTreeDataProvider,
} from './grouped-resources-tree-data-provider';
import { ResourceTreeItem, UriTreeItem } from './tree-view-utils';

const testMatcher = new SubstringExcludeMatcher('path-exclude');

// implementation of the Memento interface that uses a Map as backend
class TestMemento implements Memento {
  get<T>(key: string): T;
  get<T>(key: string, defaultValue: T): T;
  get<T>(key: unknown, defaultValue?: unknown): T | T {
    return (this.map.get(key as string) as T) || (defaultValue as T);
  }
  private map: Map<string, string> = new Map();
  keys(): readonly string[] {
    return Array.from(this.map.keys());
  }
  update(key: string, value: any): Thenable<void> {
    this.map.set(key, value);
    return Promise.resolve();
  }
}

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
      'length3',
      'note',
      new TestMemento(),
      () =>
        workspace
          .list()
          .filter(r => r.title.length === 3)
          .map(r => r.uri),
      uri => new UriTreeItem(uri),
      testMatcher
    );
    provider.groupBy.update('folder');
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
      new TestMemento(),
      () =>
        workspace
          .list()
          .filter(r => r.title.length === 3)
          .map(r => r.uri),
      uri => new ResourceTreeItem(workspace.get(uri), workspace),
      testMatcher
    );
    provider.groupBy.update('folder');

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
      'length3',
      'note',
      new TestMemento(),
      () =>
        workspace
          .list()
          .filter(r => r.title.length === 3)
          .map(r => r.uri),
      uri => new ResourceTreeItem(workspace.get(uri), workspace),
      testMatcher
    );
    provider.groupBy.update('off');

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
      'length3',
      'note',
      new TestMemento(),
      () =>
        workspace
          .list()
          .filter(r => r.title.length === 3)
          .map(r => r.uri),
      uri => new UriTreeItem(uri),
      new AlwaysIncludeMatcher()
    );
    provider.groupBy.update('folder');

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
      new TestMemento(),
      () =>
        workspace
          .list()
          .filter(r => r.title.length === 3)
          .map(r => r.uri),
      uri => new UriTreeItem(uri),
      testMatcher
    );
    provider.groupBy.update('folder');
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
