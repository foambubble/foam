import { URI } from '@foam/core';
import { createTestNote, createTestWorkspace } from '@foam/core/test';
import { createNoteItems } from './note-items';
import { NoteRecency } from './note-recency';

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

    const items = createNoteItems(workspace, new NoteRecency());

    expect(items).toHaveLength(1);
    expect(items[0].label).toEqual('Objectives and Key Results');
    expect(items[0].detail).toEqual('Alias: OKRs');
  });

  it('offers a note that declares no aliases, found by its title', () => {
    const workspace = createTestWorkspace();
    workspace.set(
      createTestNote({ uri: '/relativity.md', title: 'Relativity' })
    );

    const items = createNoteItems(workspace, new NoteRecency());

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

    const items = createNoteItems(workspace, new NoteRecency());

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

    const items = createNoteItems(workspace, new NoteRecency());

    expect(items.map(i => i.label)).toEqual(['A note']);
  });

  it('orders notes never visited by title', () => {
    const workspace = createTestWorkspace();
    workspace.set(createTestNote({ uri: '/zebra.md', title: 'Zebra' }));
    workspace.set(createTestNote({ uri: '/apple.md', title: 'Apple' }));

    const items = createNoteItems(workspace, new NoteRecency());

    expect(items.map(i => i.label)).toEqual(['Apple', 'Zebra']);
  });

  it('describes a note by its path in the workspace', () => {
    const workspace = createTestWorkspace([URI.file('/home/me/garden')]);
    workspace.set(
      createTestNote({
        uri: '/home/me/garden/plants/courgettes.md',
        title: 'Courgettes',
      })
    );

    const items = createNoteItems(workspace, new NoteRecency());

    expect(items[0].description).toEqual('plants/courgettes.md');
  });

  it('starts the path with the root folder name when the workspace has several roots', () => {
    const workspace = createTestWorkspace([
      URI.file('/home/me/garden'),
      URI.file('/home/me/work'),
    ]);
    workspace.set(
      createTestNote({ uri: '/home/me/work/goals/okrs.md', title: 'OKRs' })
    );

    const items = createNoteItems(workspace, new NoteRecency());

    expect(items[0].description).toEqual('work/goals/okrs.md');
  });

  it('offers recently visited notes first, most recent first (#1792)', () => {
    const workspace = createTestWorkspace();
    workspace.set(createTestNote({ uri: '/apple.md', title: 'Apple' }));
    workspace.set(createTestNote({ uri: '/mango.md', title: 'Mango' }));
    workspace.set(createTestNote({ uri: '/zebra.md', title: 'Zebra' }));
    const recency = new NoteRecency();
    recency.visit(workspace.find('mango').uri);
    recency.visit(workspace.find('zebra').uri);

    const items = createNoteItems(workspace, recency);

    expect(items.map(i => i.label)).toEqual(['Zebra', 'Mango', 'Apple']);
  });
});
