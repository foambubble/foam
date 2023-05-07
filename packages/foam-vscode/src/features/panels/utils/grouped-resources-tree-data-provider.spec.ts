import { FoamWorkspace } from '../../../core/model/workspace';
import {
  AlwaysIncludeMatcher,
  IMatcher,
  SubstringExcludeMatcher,
} from '../../../core/services/datastore';
import { createTestNote } from '../../../test/test-utils';
import { ResourceTreeItem, UriTreeItem } from './tree-view-utils';
import { randomString } from '../../../test/test-utils';
import { MapBasedMemento } from '../../../utils/vsc-utils';
import { URI } from 'packages/foam-vscode/src/core/model/uri';
import { TreeItem } from 'vscode';
import { GroupedResourcesTreeDataProvider } from './grouped-resources-tree-data-provider';

const testMatcher = new SubstringExcludeMatcher('path-exclude');

class TestProvider extends GroupedResourcesTreeDataProvider {
  constructor(
    matcher: IMatcher,
    private list: () => URI[],
    private create: (uri: URI) => TreeItem
  ) {
    super(randomString(), new MapBasedMemento(), matcher);
  }
  getUris(): URI[] {
    return this.list();
  }
  createValueTreeItem(value: URI) {
    return this.create(value) as any;
  }
}

describe('TestProvider', () => {
  const note1 = createTestNote({ uri: '/path/ABC.md', title: 'ABC' });
  const note2 = createTestNote({
    uri: '/path-bis/XYZ.md',
    title: 'XYZ',
  });
  const note3 = createTestNote({
    uri: '/path-bis/ABCDEFG.md',
    title: 'ABCDEFG',
  });
  const excludedNote = createTestNote({
    uri: '/path-exclude/HIJ.m',
    title: 'HIJ',
  });

  const workspace = new FoamWorkspace()
    .set(note1)
    .set(note2)
    .set(note3)
    .set(excludedNote);

  it('should return the grouped resources as a folder tree', async () => {
    const provider = new TestProvider(
      testMatcher,
      () => workspace.list().map(r => r.uri),
      uri => new UriTreeItem(uri)
    );
    provider.groupBy.update('folder');
    provider.refresh();
    const result = await provider.getChildren();
    expect(result).toMatchObject([
      {
        collapsibleState: 1,
        label: '/path',
        description: '(1)',
      },
      {
        collapsibleState: 1,
        label: '/path-bis',
        description: '(2)',
      },
    ]);
  });
  it('should return the grouped resources in a directory', async () => {
    const provider = new TestProvider(
      testMatcher,
      () => workspace.list().map(r => r.uri),
      uri => new ResourceTreeItem(workspace.get(uri), workspace)
    );
    provider.groupBy.update('folder');
    provider.refresh();
    const paths = await provider.getChildren();
    const directory = paths[0];
    expect(directory).toMatchObject({
      label: '/path',
    });
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
    const provider = new TestProvider(
      testMatcher,
      () => workspace.list().map(r => r.uri),
      uri => new ResourceTreeItem(workspace.get(uri), workspace)
    );
    provider.groupBy.update('off');
    provider.refresh();
    const result = await provider.getChildren();
    expect(result).toMatchObject([
      {
        collapsibleState: 0,
        label: note1.title,
        description: '/path/ABC.md',
        command: { command: 'vscode.open' },
      },
      {
        collapsibleState: 0,
        label: note3.title,
        description: '/path-bis/ABCDEFG.md',
        command: { command: 'vscode.open' },
      },
      {
        collapsibleState: 0,
        label: note2.title,
        description: '/path-bis/XYZ.md',
        command: { command: 'vscode.open' },
      },
    ]);
  });
  it('should return the grouped resources without exclusion', async () => {
    const provider = new TestProvider(
      new AlwaysIncludeMatcher(),
      () => workspace.list().map(r => r.uri),
      uri => new UriTreeItem(uri)
    );
    provider.groupBy.update('folder');
    provider.refresh();
    const result = await provider.getChildren();
    expect(result.length).toEqual(3);
    expect(result).toMatchObject([
      {
        collapsibleState: 1,
        label: '/path',
        description: '(1)',
      },
      {
        collapsibleState: 1,
        label: '/path-bis',
        description: '(2)',
      },
      {
        collapsibleState: 1,
        label: '/path-exclude',
        description: '(1)',
      },
    ]);
  });
});
