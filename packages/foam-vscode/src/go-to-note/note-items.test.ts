import { URI } from '@foam/core';
import { createTestNote, createTestWorkspace } from '@foam/core/test';
import { createNoteItems } from './note-items';
import { NoteRecency } from './note-recency';

const byPath = (uri: URI) => uri.path;

describe('createNoteItems', () => {
  it('labels a note with its title and shows the aliases it can be found by (#1792)', () => {
    const workspace = createTestWorkspace();
    workspace.set(
      createTestNote({
        uri: '/objectives-and-key-results.md',
        title: 'Objectives and Key Results',
        aliases: ['OKRs'],
      })
    );

    const items = createNoteItems(workspace, new NoteRecency(), byPath);

    expect(items).toHaveLength(1);
    expect(items[0].label).toEqual('Objectives and Key Results');
    expect(items[0].detail).toEqual('Alias: OKRs');
  });

  it('offers a note that declares no aliases, found by its title', () => {
    const workspace = createTestWorkspace();
    workspace.set(
      createTestNote({ uri: '/relativity.md', title: 'Relativity' })
    );

    const items = createNoteItems(workspace, new NoteRecency(), byPath);

    expect(items).toHaveLength(1);
    expect(items[0].label).toEqual('Relativity');
    expect(items[0].detail).toBeUndefined();
  });

  it('offers a note with several aliases once, listing them together', () => {
    const workspace = createTestWorkspace();
    workspace.set(
      createTestNote({
        uri: '/objectives-and-key-results.md',
        title: 'Objectives and Key Results',
        aliases: ['OKRs', 'Goal setting'],
      })
    );

    const items = createNoteItems(workspace, new NoteRecency(), byPath);

    expect(items).toHaveLength(1);
    expect(items[0].detail).toEqual('Alias: OKRs, Goal setting');
  });

  it('offers notes only, not attachments', () => {
    const workspace = createTestWorkspace();
    workspace.set(createTestNote({ uri: '/note.md', title: 'A note' }));
    workspace.set(
      createTestNote({
        uri: '/diagram.png',
        title: 'diagram.png',
        type: 'attachment',
      })
    );

    const items = createNoteItems(workspace, new NoteRecency(), byPath);

    expect(items.map(i => i.label)).toEqual(['A note']);
  });

  it('describes a note by its path, and orders notes never visited by title', () => {
    const workspace = createTestWorkspace();
    workspace.set(createTestNote({ uri: '/zebra.md', title: 'Zebra' }));
    workspace.set(createTestNote({ uri: '/apple.md', title: 'Apple' }));

    const items = createNoteItems(workspace, new NoteRecency(), byPath);

    expect(items.map(i => i.label)).toEqual(['Apple', 'Zebra']);
    expect(items[0].description).toEqual(workspace.find('apple').uri.path);
  });

  it('offers recently visited notes first, most recent first (#1792)', () => {
    const workspace = createTestWorkspace();
    workspace.set(createTestNote({ uri: '/apple.md', title: 'Apple' }));
    workspace.set(createTestNote({ uri: '/mango.md', title: 'Mango' }));
    workspace.set(createTestNote({ uri: '/zebra.md', title: 'Zebra' }));
    const recency = new NoteRecency();
    recency.visit(workspace.find('mango').uri);
    recency.visit(workspace.find('zebra').uri);

    const items = createNoteItems(workspace, recency, byPath);

    expect(items.map(i => i.label)).toEqual(['Zebra', 'Mango', 'Apple']);
  });
});
