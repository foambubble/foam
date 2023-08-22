import { createTestNote } from '../../test/test-utils';
import { cleanWorkspace, closeEditors } from '../../test/test-utils-vscode';
import { TagItem, TagsProvider } from './tags-explorer';
import { FoamTags } from '../../core/model/tags';
import { FoamWorkspace } from '../../core/model/workspace';
import { ResourceTreeItem } from './utils/tree-view-utils';

describe('Tags tree panel', () => {
  beforeAll(async () => {
    await cleanWorkspace();
  });

  afterAll(async () => {
    await cleanWorkspace();
  });

  beforeEach(async () => {
    await closeEditors();
  });

  it('provides a tag from a set of notes', async () => {
    const noteA = createTestNote({
      tags: ['test'],
      uri: './note-a.md',
    });
    const workspace = new FoamWorkspace().set(noteA);
    const foamTags = FoamTags.fromWorkspace(workspace);
    const provider = new TagsProvider(foamTags, workspace, false);
    provider.refresh();

    const treeItems = (await provider.getChildren()) as TagItem[];

    expect(treeItems).toHaveLength(1);
    expect(treeItems[0].label).toEqual('test');
    expect(treeItems[0].tag).toEqual('test');
    expect(treeItems[0].nResourcesInSubtree).toEqual(1);
  });

  it('handles a simple parent and child tag', async () => {
    const noteA = createTestNote({
      tags: ['parent/child'],
      uri: './note-a.md',
    });
    const workspace = new FoamWorkspace().set(noteA);
    const foamTags = FoamTags.fromWorkspace(workspace);
    const provider = new TagsProvider(foamTags, workspace, false);
    provider.refresh();

    const parentTreeItems = (await provider.getChildren()) as TagItem[];
    const parentTagItem = parentTreeItems.pop();
    expect(parentTagItem.label).toEqual('parent');

    const childTreeItems = (await provider.getChildren(
      parentTagItem
    )) as TagItem[];

    childTreeItems.forEach(child => {
      if (child instanceof TagItem) {
        // eslint-disable-next-line jest/no-conditional-expect
        expect(child.label).toEqual('child');
      }
    });
  });

  it('handles a single parent and multiple child tag', async () => {
    const noteA = createTestNote({
      tags: ['parent/child'],
      uri: './note-a.md',
    });
    const noteB = createTestNote({
      tags: ['parent/subchild'],
      uri: './note-b.md',
    });
    const workspace = new FoamWorkspace().set(noteA).set(noteB);
    const foamTags = FoamTags.fromWorkspace(workspace);
    const provider = new TagsProvider(foamTags, workspace, false);
    provider.refresh();

    const parentTreeItems = (await provider.getChildren()) as TagItem[];
    const parentTagItem = parentTreeItems.filter(
      item => item instanceof TagItem
    )[0];

    expect(parentTagItem.label).toEqual('parent');
    expect(parentTreeItems).toHaveLength(1);

    const childTreeItems = (await provider.getChildren(
      parentTagItem
    )) as TagItem[];

    childTreeItems.forEach(child => {
      if (child instanceof TagItem) {
        // eslint-disable-next-line jest/no-conditional-expect
        expect(['child', 'subchild']).toContain(child.label);
        // eslint-disable-next-line jest/no-conditional-expect
        expect(child.label).not.toEqual('parent');
      }
    });
    expect(childTreeItems).toHaveLength(2);
  });

  it('handles a parent and child tag in the same note', async () => {
    const noteC = createTestNote({
      tags: ['main', 'main/subtopic'],
      title: 'Test note',
      uri: './note-c.md',
    });
    const workspace = new FoamWorkspace().set(noteC);
    const foamTags = FoamTags.fromWorkspace(workspace);
    const provider = new TagsProvider(foamTags, workspace, false);

    provider.refresh();

    const parentTreeItems = (await provider.getChildren()) as TagItem[];
    const parentTagItem = parentTreeItems.filter(
      item => item instanceof TagItem
    )[0];

    expect(parentTagItem.label).toEqual('main');

    const childTreeItems = (await provider.getChildren(
      parentTagItem
    )) as TagItem[];

    childTreeItems
      .filter(item => item instanceof ResourceTreeItem)
      .forEach(item => {
        expect(item.label).toEqual('Test note');
      });

    childTreeItems
      .filter(item => item instanceof TagItem)
      .forEach(item => {
        expect(['main/subtopic']).toContain(item.tag);
        expect(item.label).toEqual('subtopic');
      });

    expect(childTreeItems).toHaveLength(2);
  });

  it('handles a tag with multiple levels of hierarchy - #1134', async () => {
    const noteA = createTestNote({
      tags: ['parent/child/second'],
      uri: './note-a.md',
    });
    const workspace = new FoamWorkspace().set(noteA);
    const foamTags = FoamTags.fromWorkspace(workspace);
    const provider = new TagsProvider(foamTags, workspace, false);

    provider.refresh();

    const parentTreeItems = (await provider.getChildren()) as TagItem[];
    const parentTagItem = parentTreeItems.pop();
    expect(parentTagItem.label).toEqual('parent');

    const childTreeItems = (await provider.getChildren(
      parentTagItem
    )) as TagItem[];

    expect(childTreeItems).toHaveLength(1);
    expect(childTreeItems[0].label).toEqual('child');

    const grandchildTreeItems = (await provider.getChildren(
      childTreeItems[0]
    )) as TagItem[];

    expect(grandchildTreeItems).toHaveLength(1);
    expect(grandchildTreeItems[0].label).toEqual('second');
  });
});
