import fs from 'node:fs';
import path from 'node:path';
import { window } from 'vscode';
import { createTestNote, createTestWorkspace } from '@foam/core/test';
import { createNoteItems, goToNote, GO_TO_NOTE_COMMAND } from './go-to-note';

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
        uri: '/einstein.md',
        title: 'Einstein, Albert',
        aliases: ['Einstein'],
      })
    );

    const items = createNoteItems(workspace);

    expect(items).toHaveLength(1);
    expect(items[0].label).toEqual('Einstein, Albert');
    expect(items[0].detail).toEqual('Alias: Einstein');
  });

  it('asks the picker to match the query against aliases and paths too (#1792)', async () => {
    const workspace = createTestWorkspace();
    workspace.set(
      createTestNote({
        uri: '/einstein.md',
        title: 'Einstein, Albert',
        aliases: ['Einstein'],
      })
    );
    const showQuickPick = vi
      .spyOn(window, 'showQuickPick')
      .mockImplementationOnce(vi.fn(() => Promise.resolve(undefined)));

    await goToNote(workspace);

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

    const items = createNoteItems(workspace);

    expect(items).toHaveLength(1);
    expect(items[0].label).toEqual('Relativity');
    expect(items[0].detail).toBeUndefined();
  });

  it('offers a note with several aliases once, listing them together', () => {
    const workspace = createTestWorkspace();
    workspace.set(
      createTestNote({
        uri: '/einstein.md',
        title: 'Einstein, Albert',
        aliases: ['Einstein', 'Albert Einstein'],
      })
    );

    const items = createNoteItems(workspace);

    expect(items).toHaveLength(1);
    expect(items[0].detail).toEqual('Alias: Einstein, Albert Einstein');
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

    const items = createNoteItems(workspace);

    expect(items.map(i => i.label)).toEqual(['A note']);
  });

  it('describes a note by its path, and orders notes by title', () => {
    const workspace = createTestWorkspace();
    workspace.set(createTestNote({ uri: '/zebra.md', title: 'Zebra' }));
    workspace.set(createTestNote({ uri: '/apple.md', title: 'Apple' }));

    const items = createNoteItems(workspace);

    expect(items.map(i => i.label)).toEqual(['Apple', 'Zebra']);
    expect(items[0].description).toContain('apple.md');
  });

  it('is contributed to the command palette with no default keybinding', () => {
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
    expect(pkg.contributes.keybindings.map(b => b.command)).not.toContain(
      GO_TO_NOTE_COMMAND.command
    );
  });
});
