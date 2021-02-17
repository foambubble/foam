import {
  BlankNotesProvider,
  Directory,
  BlankNotesProviderConfig,
} from './blank-notes';
import { BlankNotesConfigGroupBy } from '../settings';

describe('blankNotes', () => {
  // Rough mocks of NoteGraphAPI
  const blankNoteA = {
    uri: {
      fsPath: '/path/blank-note-a.md',
      path: '/path/blank-note-a.md',
    },
    title: 'Blank Note A',
    source: {
      text: '# Blank Note A\n',
    },
  };
  const blankNoteB = {
    uri: {
      fsPath: '/path-bis/blank-note-b.md',
      path: '/path-bis/blank-note-b.md',
    },
    title: 'Blank Note B',
    source: {
      text: '# Blank Note B\n \n \n',
    },
  };
  const blankNoteC = {
    uri: {
      fsPath: '/path-exclude/blank-note-c.md',
      path: '/path-exclude/blank-note-c.md',
    },
    title: 'Blank Note C',
    source: {
      text: '# Blank Note C\n \n \n',
    },
  };
  const notBlankNoteA = {
    uri: { fsPath: '/path/not-blank-note.md', path: '/path/not-blank-note.md' },
    title: 'Not Blank Note',
    source: {
      text: '# Note Blank Note\n This note is not blank\n It has text in it\n',
    },
  };
  const notes = [blankNoteA, blankNoteB, blankNoteC, notBlankNoteA];
  const foam = {
    notes: {
      getNotes: () => notes,
    },
  } as any;
  const dataStore = { read: () => '' } as any;

  // Mock config
  const config: BlankNotesProviderConfig = {
    exclude: ['path-exclude/**/*'],
    groupBy: BlankNotesConfigGroupBy.Folder,
    workspacesFsPaths: [''],
  };

  it('should return the blank notes as a folder tree', async () => {
    const provider = new BlankNotesProvider(foam, dataStore, config);
    const result = await provider.getChildren();
    expect(result).toMatchObject([
      {
        collapsibleState: 1,
        label: '/path',
        description: '1 blankNote',
        notes: [{ title: 'Blank Note A' }],
      },
      {
        collapsibleState: 1,
        label: '/path-bis',
        description: '1 blankNote',
        notes: [{ title: 'Blank Note B' }],
      },
    ]);
  });

  it('should return the blank notes in a directory', async () => {
    const provider = new BlankNotesProvider(foam, dataStore, config);
    const directory = new Directory('/path', [blankNoteA as any]);
    const result = await provider.getChildren(directory);
    expect(result).toMatchObject([
      {
        collapsibleState: 0,
        label: 'Blank Note A',
        description: '/path/blank-note-a.md',
        command: { command: 'vscode.open' },
      },
    ]);
  });

  it('should return the flattened blank notes', async () => {
    const mockConfig = { ...config, groupBy: BlankNotesConfigGroupBy.Off };
    const provider = new BlankNotesProvider(foam, dataStore, mockConfig);
    const result = await provider.getChildren();
    expect(result).toMatchObject([
      {
        collapsibleState: 0,
        label: 'Blank Note A',
        description: '/path/blank-note-a.md',
        command: { command: 'vscode.open' },
      },
      {
        collapsibleState: 0,
        label: 'Blank Note B',
        description: '/path-bis/blank-note-b.md',
        command: { command: 'vscode.open' },
      },
    ]);
  });

  it('should return the blank notes without exclusion', async () => {
    const mockConfig = { ...config, exclude: [] };
    const provider = new BlankNotesProvider(foam, dataStore, mockConfig);
    const result = await provider.getChildren();
    expect(result).toMatchObject([
      expect.anything(),
      expect.anything(),
      {
        collapsibleState: 1,
        label: '/path-exclude',
        description: '1 blankNote',
        notes: [{ title: 'Blank Note C' }],
      },
    ]);
  });
});
