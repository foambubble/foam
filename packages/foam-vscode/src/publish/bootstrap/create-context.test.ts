import { URI } from '@foam/core';
import {
  createNoteFromMarkdown,
  createTestNote,
  createTestWorkspace,
  InMemoryDataStore,
} from '../../test/test-utils';
import { createPublishContext } from './create-context';

describe('createPublishContext', () => {
  it('publishes an asset once when multiple notes link to it and grows linkedFrom context', () => {
    const root = URI.file('/');
    const dataStore = new InMemoryDataStore();
    const workspace = createTestWorkspace([root], dataStore);

    const noteAUri = root.joinPath('note-a.md');
    const noteBUri = root.joinPath('note-b.md');
    const assetUri = root.joinPath('assets', 'logo.png');
    const noteContent = ['# Note', '', '![Logo](./assets/logo.png)'].join('\n');
    const linkedFromSnapshots: string[][] = [];

    dataStore.set(noteAUri, noteContent);
    dataStore.set(noteBUri, noteContent);

    workspace
      .set(createNoteFromMarkdown('note-a.md', noteContent, root))
      .set(createNoteFromMarkdown('note-b.md', noteContent, root))
      .set(
        createTestNote({
          uri: '/assets/logo.png',
          title: 'logo.png',
          type: 'image',
        })
      );

    const context = createPublishContext({
      workspace,
      includeAsset: (_asset, publishContext) => {
        linkedFromSnapshots.push(
          publishContext.linkedFrom.map(note => note.uri.path).sort()
        );
        return true;
      },
    });

    expect(context.assets.map(resource => resource.uri.path)).toEqual([
      assetUri.path,
    ]);
    expect(linkedFromSnapshots).toHaveLength(2);
    expect(linkedFromSnapshots[0]).toHaveLength(1);
    expect([noteAUri.path, noteBUri.path]).toContain(linkedFromSnapshots[0][0]);
    expect(linkedFromSnapshots[1]).toEqual(
      [noteAUri.path, noteBUri.path].sort()
    );
  });

  it('keeps linkedFrom unique when the same note links the asset multiple times', () => {
    const root = URI.file('/');
    const dataStore = new InMemoryDataStore();
    const workspace = createTestWorkspace([root], dataStore);

    const homeUri = root.joinPath('index.md');
    const assetUri = root.joinPath('assets', 'logo.png');
    const homeContent = [
      '# Home',
      '',
      '![Logo](./assets/logo.png)',
      '![Logo Again](./assets/logo.png)',
    ].join('\n');
    const linkedFromSnapshots: string[][] = [];

    dataStore.set(homeUri, homeContent);

    workspace
      .set(createNoteFromMarkdown('index.md', homeContent, root))
      .set(
        createTestNote({
          uri: '/assets/logo.png',
          title: 'logo.png',
          type: 'image',
        })
      );

    const context = createPublishContext({
      workspace,
      includeAsset: (_asset, publishContext) => {
        linkedFromSnapshots.push(
          publishContext.linkedFrom.map(note => note.uri.path)
        );
        return true;
      },
    });

    expect(context.assets.map(resource => resource.uri.path)).toEqual([
      assetUri.path,
    ]);
    expect(linkedFromSnapshots).toEqual([[homeUri.path], [homeUri.path]]);
  });
});
