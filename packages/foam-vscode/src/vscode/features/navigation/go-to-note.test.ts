import fs from 'node:fs';
import path from 'node:path';
import { window } from 'vscode';
import { createTestNote, createTestWorkspace } from '@foam/core/test';
import { createNoteItems, goToNote, GO_TO_NOTE_COMMAND } from './go-to-note';
import { NoteRecency } from './note-recency';

/** This extension's package.json, as VS Code reads it. */
const packageJson = () =>
  JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../../../package.json'), 'utf8')
  );

describe('go-to-note', () => {
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

  it('asks the picker to match the query against aliases and paths too (#1792)', async () => {
    const workspace = createTestWorkspace();
    workspace.set(
      createTestNote({
        uri: '/objectives-and-key-results.md',
        title: 'Objectives and Key Results',
        aliases: ['OKRs'],
      })
    );
    const showQuickPick = vi
      .spyOn(window, 'showQuickPick')
      .mockImplementationOnce(vi.fn(() => Promise.resolve(undefined)));

    await goToNote(workspace, new NoteRecency());

    const options = showQuickPick.mock.calls[0][1] as {
      matchOnDescription?: boolean;
      matchOnDetail?: boolean;
    };
    expect(options.matchOnDetail).toBe(true);
    expect(options.matchOnDescription).toBe(true);
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

  it('describes a note by its path, and orders notes never visited by title', () => {
    const workspace = createTestWorkspace();
    workspace.set(createTestNote({ uri: '/zebra.md', title: 'Zebra' }));
    workspace.set(createTestNote({ uri: '/apple.md', title: 'Apple' }));

    const items = createNoteItems(workspace, new NoteRecency());

    expect(items.map(i => i.label)).toEqual(['Apple', 'Zebra']);
    expect(items[0].description).toContain('apple.md');
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

  it('is contributed to the command palette, bound to ctrl+alt+p / cmd+alt+p', () => {
    const pkg = packageJson();

    expect(pkg.contributes.commands).toEqual(
      expect.arrayContaining([
        {
          command: GO_TO_NOTE_COMMAND.command,
          title: GO_TO_NOTE_COMMAND.title,
        },
      ])
    );
    expect(
      pkg.contributes.menus.commandPalette.map(entry => entry.command)
    ).not.toContain(GO_TO_NOTE_COMMAND.command);
    expect(pkg.contributes.keybindings).toEqual(
      expect.arrayContaining([
        {
          command: GO_TO_NOTE_COMMAND.command,
          key: 'ctrl+alt+p',
          mac: 'cmd+alt+p',
        },
      ])
    );
  });
});
