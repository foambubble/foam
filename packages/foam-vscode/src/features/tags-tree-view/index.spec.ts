import {
  cleanWorkspace,
  closeEditors,
  createTestNote,
} from '../../test/test-utils';

import { Tag, TagReference, TagsProvider } from '.';

import {
  bootstrap,
  createConfigFromFolders,
  Foam,
  FileDataStore,
  FoamConfig,
  MarkdownResourceProvider,
  Matcher,
} from 'foam-core';

describe('Tags tree panel', () => {
  let _foam: Foam;
  let provider: TagsProvider;

  const config: FoamConfig = createConfigFromFolders([]);
  const mdProvider = new MarkdownResourceProvider(
    new Matcher(
      config.workspaceFolders,
      config.includeGlobs,
      config.ignoreGlobs
    )
  );

  beforeAll(async () => {
    await cleanWorkspace();
  });

  afterAll(async () => {
    _foam.dispose();
    await cleanWorkspace();
  });

  beforeEach(async () => {
    _foam = await bootstrap(config, new FileDataStore(), [mdProvider]);
    provider = new TagsProvider(_foam, _foam.workspace);
    await closeEditors();
  });

  afterEach(() => {
    _foam.dispose();
  });

  it('correctly provides a tag from a set of notes', async () => {
    const noteA = createTestNote({
      tags: new Set(['test']),
      uri: './note-a.md',
    });
    _foam.workspace.set(noteA);
    provider.refresh();

    const treeItems = (await provider.getChildren()) as Tag[];

    treeItems.map(item => expect(item.tag).toContain('test'));
  });

  it('correctly handles a parent and child tag', async () => {
    const noteA = createTestNote({
      tags: new Set(['parent/child']),
      uri: './note-a.md',
    });
    _foam.workspace.set(noteA);
    provider.refresh();

    const parentTreeItems = (await provider.getChildren()) as Tag[];
    const parentTagItem = parentTreeItems.pop();
    expect(parentTagItem.title).toEqual('parent');

    const childTreeItems = (await provider.getChildren(parentTagItem)) as Tag[];

    childTreeItems.forEach(child => {
      if (child instanceof Tag) {
        expect(child.title).toEqual('child');
      }
    });
  });

  it('correctly handles a single parent and multiple child tag', async () => {
    const noteA = createTestNote({
      tags: new Set(['parent/child']),
      uri: './note-a.md',
    });
    _foam.workspace.set(noteA);
    const noteB = createTestNote({
      tags: new Set(['parent/subchild']),
      uri: './note-b.md',
    });
    _foam.workspace.set(noteB);
    provider.refresh();

    const parentTreeItems = (await provider.getChildren()) as Tag[];
    const parentTagItem = parentTreeItems.filter(
      item => item instanceof Tag
    )[0];

    expect(parentTagItem.title).toEqual('parent');
    expect(parentTreeItems).toHaveLength(1);

    const childTreeItems = (await provider.getChildren(parentTagItem)) as Tag[];

    childTreeItems.forEach(child => {
      if (child instanceof Tag) {
        expect(['child', 'subchild']).toContain(child.title);
        expect(child.title).not.toEqual('parent');
      }
    });
    expect(childTreeItems).toHaveLength(3);
  });

  it('correctly handles a single parent and child tag in the same note', async () => {
    const noteC = createTestNote({
      tags: new Set(['main', 'main/subtopic']),
      title: 'Test note',
      uri: './note-c.md',
    });

    _foam.workspace.set(noteC);

    provider.refresh();

    const parentTreeItems = (await provider.getChildren()) as Tag[];
    const parentTagItem = parentTreeItems.filter(
      item => item instanceof Tag
    )[0];

    expect(parentTagItem.title).toEqual('main');

    const childTreeItems = (await provider.getChildren(parentTagItem)) as Tag[];

    childTreeItems
      .filter(item => item instanceof TagReference)
      .forEach(item => {
        expect(item.title).toEqual('Test note');
      });

    childTreeItems
      .filter(item => item instanceof Tag)
      .forEach(item => {
        expect(['main/subtopic']).toContain(item.tag);
        expect(item.title).toEqual('subtopic');
      });

    expect(childTreeItems).toHaveLength(3);
  });
});
