import { FoamWorkspace, Note } from 'foam-core';
import { FilteredNotesConfigGroupBy } from '../settings';
import { createTestNote } from '../test/test-utils';
import {
  Directory,
  FilteredNotesProvider,
  FilteredNotesProviderConfig,
} from './filtered-notes';

describe('filteredNotes', () => {
  const isMatch = (note: Note) => {
    return note.title.length === 3;
  };
  const matchingNote1 = createTestNote({ uri: '/path/ABC.md', title: 'ABC' });
  const matchingNote2 = createTestNote({
    uri: '/path-bis/XYZ.md',
    title: 'XYZ',
  });
  const excludedPathNote = createTestNote({
    uri: '/path-exclude/HIJ.m',
    title: 'HIJ',
  });
  const notMatchingNote = createTestNote({
    uri: '/path-bis/ABCDEFG.md',
    title: 'ABCDEFG',
  });

  const workspace = new FoamWorkspace()
    .set(matchingNote1)
    .set(matchingNote2)
    .set(excludedPathNote)
    .set(notMatchingNote)
    .resolveLinks();

  const dataStore = { read: () => '' } as any;

  // Mock config
  const config: FilteredNotesProviderConfig = {
    exclude: ['path-exclude/**/*'],
    groupBy: FilteredNotesConfigGroupBy.Folder,
    workspacesFsPaths: [''],
  };

  it('should return the filtered notes as a folder tree', async () => {
    const provider = new FilteredNotesProvider(
      workspace,
      dataStore,
      'length3',
      'note',
      isMatch,
      config
    );
    const result = await provider.getChildren();
    expect(result).toMatchObject([
      {
        collapsibleState: 1,
        label: '/path',
        description: '1 note',
        notes: [{ title: matchingNote1.title }],
      },
      {
        collapsibleState: 1,
        label: '/path-bis',
        description: '1 note',
        notes: [{ title: matchingNote2.title }],
      },
    ]);
  });

  it('should return the filtered notes in a directory', async () => {
    const provider = new FilteredNotesProvider(
      workspace,
      dataStore,
      'length3',
      'note',
      isMatch,
      config
    );
    const directory = new Directory('/path', [matchingNote1 as any], 'note');
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

  it('should return the flattened filtered notes', async () => {
    const mockConfig = { ...config, groupBy: FilteredNotesConfigGroupBy.Off };
    const provider = new FilteredNotesProvider(
      workspace,
      dataStore,
      'length3',
      'note',
      isMatch,
      mockConfig
    );
    const result = await provider.getChildren();
    expect(result).toMatchObject([
      {
        collapsibleState: 0,
        label: matchingNote1.title,
        description: matchingNote1.uri.fsPath,
        command: { command: 'vscode.open' },
      },
      {
        collapsibleState: 0,
        label: matchingNote2.title,
        description: matchingNote2.uri.fsPath,
        command: { command: 'vscode.open' },
      },
    ]);
  });

  it('should return the filtered notes without exclusion', async () => {
    const mockConfig = { ...config, exclude: [] };
    const provider = new FilteredNotesProvider(
      workspace,
      dataStore,
      'length3',
      'note',
      isMatch,
      mockConfig
    );
    const result = await provider.getChildren();
    expect(result).toMatchObject([
      expect.anything(),
      expect.anything(),
      {
        collapsibleState: 1,
        label: '/path-exclude',
        description: '1 note',
        notes: [{ title: excludedPathNote.title }],
      },
    ]);
  });

  it('should dynamically set the description', async () => {
    const description = 'test description';
    const provider = new FilteredNotesProvider(
      workspace,
      dataStore,
      'length3',
      description,
      isMatch,
      config
    );
    const result = await provider.getChildren();
    expect(result).toMatchObject([
      {
        collapsibleState: 1,
        label: '/path',
        description: `1 ${description}`,
        notes: expect.anything(),
      },
      {
        collapsibleState: 1,
        label: '/path-bis',
        description: `1 ${description}`,
        notes: expect.anything(),
      },
    ]);
  });
});
