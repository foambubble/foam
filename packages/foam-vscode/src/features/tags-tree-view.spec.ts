import { createTestNote, readFileFromFs } from '../test/test-utils';
import { cleanWorkspace, closeEditors } from '../test/test-utils-vscode';
import { TagItem, TagReference, TagsProvider } from './tags-tree-view';
import { bootstrap, Foam } from '../core/model/foam';
import { MarkdownResourceProvider } from '../core/services/markdown-provider';
import { FileDataStore, Matcher } from '../core/services/datastore';

describe('Tags tree panel', () => {
  let _foam: Foam;
  let provider: TagsProvider;

  const dataStore = new FileDataStore(readFileFromFs);
  const matcher = new Matcher([]);
  const mdProvider = new MarkdownResourceProvider(matcher, dataStore);

  beforeAll(async () => {
    await cleanWorkspace();
  });

  afterAll(async () => {
    _foam.dispose();
    await cleanWorkspace();
  });

  beforeEach(async () => {
    _foam = await bootstrap(matcher, dataStore, [mdProvider]);
    provider = new TagsProvider(_foam, _foam.workspace);
    await closeEditors();
  });

  afterEach(() => {
    _foam.dispose();
  });

  it('correctly provides a tag from a set of notes', async () => {
    const noteA = createTestNote({
      tags: ['test'],
      uri: './note-a.md',
    });
    _foam.workspace.set(noteA);
    provider.refresh();

    const treeItems = (await provider.getChildren()) as TagItem[];

    treeItems.forEach(item => expect(item.tag).toContain('test'));
  });

  it('correctly handles a parent and child tag', async () => {
    const noteA = createTestNote({
      tags: ['parent/child'],
      uri: './note-a.md',
    });
    _foam.workspace.set(noteA);
    provider.refresh();

    const parentTreeItems = (await provider.getChildren()) as TagItem[];
    const parentTagItem = parentTreeItems.pop();
    expect(parentTagItem.title).toEqual('parent');

    const childTreeItems = (await provider.getChildren(
      parentTagItem
    )) as TagItem[];

    childTreeItems.forEach(child => {
      if (child instanceof TagItem) {
        // eslint-disable-next-line jest/no-conditional-expect
        expect(child.title).toEqual('child');
      }
    });
  });

  it('correctly handles a single parent and multiple child tag', async () => {
    const noteA = createTestNote({
      tags: ['parent/child'],
      uri: './note-a.md',
    });
    _foam.workspace.set(noteA);
    const noteB = createTestNote({
      tags: ['parent/subchild'],
      uri: './note-b.md',
    });
    _foam.workspace.set(noteB);
    provider.refresh();

    const parentTreeItems = (await provider.getChildren()) as TagItem[];
    const parentTagItem = parentTreeItems.filter(
      item => item instanceof TagItem
    )[0];

    expect(parentTagItem.title).toEqual('parent');
    expect(parentTreeItems).toHaveLength(1);

    const childTreeItems = (await provider.getChildren(
      parentTagItem
    )) as TagItem[];

    childTreeItems.forEach(child => {
      if (child instanceof TagItem) {
        // eslint-disable-next-line jest/no-conditional-expect
        expect(['child', 'subchild']).toContain(child.title);
        // eslint-disable-next-line jest/no-conditional-expect
        expect(child.title).not.toEqual('parent');
      }
    });
    expect(childTreeItems).toHaveLength(3);
  });

  it('correctly handles a single parent and child tag in the same note', async () => {
    const noteC = createTestNote({
      tags: ['main', 'main/subtopic'],
      title: 'Test note',
      uri: './note-c.md',
    });

    _foam.workspace.set(noteC);

    provider.refresh();

    const parentTreeItems = (await provider.getChildren()) as TagItem[];
    const parentTagItem = parentTreeItems.filter(
      item => item instanceof TagItem
    )[0];

    expect(parentTagItem.title).toEqual('main');

    const childTreeItems = (await provider.getChildren(
      parentTagItem
    )) as TagItem[];

    childTreeItems
      .filter(item => item instanceof TagReference)
      .forEach(item => {
        expect(item.title).toEqual('Test note');
      });

    childTreeItems
      .filter(item => item instanceof TagItem)
      .forEach(item => {
        expect(['main/subtopic']).toContain(item.tag);
        expect(item.title).toEqual('subtopic');
      });

    expect(childTreeItems).toHaveLength(3);
  });
});
