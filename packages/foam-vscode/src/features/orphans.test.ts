import * as vscode from 'vscode';
import { OrphansProvider, Directory } from './orphans';
import { OrphansConfig, OrphansConfigGroupBy } from '../settings';

describe('orphans', () => {
  // Rough mocks of NoteGraphAPI
  const orphanA = {
    uri: { path: '/path/orphan-a.md' },
    title: 'Orphan A',
    links: [],
  };
  const orphanB = {
    uri: { path: '/path-bis/orphan-b.md' },
    title: 'Orphan B',
    links: [],
  };
  const orphanC = {
    uri: { path: '/path-exclude/orphan-c.md' },
    title: 'Orphan C',
    links: [],
  };
  const notOrphanNote = {
    uri: { path: '/path/not-orphan.md' },
    title: 'Not-Orphan',
    links: [{ from: '', to: '' }],
  };
  const notes = [orphanA, orphanB, orphanC, notOrphanNote];
  const foam = {
    notes: {
      getNotes: () => notes,
      getAllLinks: (uri: { path: string }) => {
        switch (uri.path) {
          case orphanA.uri.path:
            return orphanA.links;
          case orphanB.uri.path:
            return orphanB.links;
          case orphanC.uri.path:
            return orphanC.links;
          default:
            return notOrphanNote.links;
        }
      },
    },
  } as any;

  // Mock config
  const config: OrphansConfig = {
    exclude: ['path-exclude'],
    groupBy: OrphansConfigGroupBy.Folder,
  };

  it('should return the orphans as a folder tree', async () => {
    const provider = new OrphansProvider(foam, config);
    const result = await provider.getChildren();
    expect(result).toMatchObject([
      {
        collapsibleState: 1,
        label: '/path',
        description: '1 orphan',
        notes: [{ title: 'Orphan A' }],
      },
      {
        collapsibleState: 1,
        label: '/path-bis',
        description: '1 orphan',
        notes: [{ title: 'Orphan B' }],
      },
    ]);
  });

  it('should return the orphans in a directory', async () => {
    const provider = new OrphansProvider(foam, config);
    const directory = new Directory('/path', [orphanA as any]);
    const result = await provider.getChildren(directory);
    expect(result).toMatchObject([
      {
        collapsibleState: 0,
        label: 'Orphan A',
        description: '/path/orphan-a.md',
        command: { command: 'vscode.open' },
      },
    ]);
  });

  it('should return the flattened orphans', async () => {
    const mockConfig = { ...config, groupBy: OrphansConfigGroupBy.Off };
    const provider = new OrphansProvider(foam, mockConfig);
    const result = await provider.getChildren();
    expect(result).toMatchObject([
      {
        collapsibleState: 0,
        label: 'Orphan A',
        description: '/path/orphan-a.md',
        command: { command: 'vscode.open' },
      },
      {
        collapsibleState: 0,
        label: 'Orphan B',
        description: '/path-bis/orphan-b.md',
        command: { command: 'vscode.open' },
      },
    ]);
  });

  it('should return the orphans without exclusion', async () => {
    const mockConfig = { ...config, exclude: [] };
    const provider = new OrphansProvider(foam, mockConfig);
    const result = await provider.getChildren();
    expect(result).toMatchObject([
      expect.anything(),
      expect.anything(),
      {
        collapsibleState: 1,
        label: '/path-exclude',
        description: '1 orphan',
        notes: [{ title: 'Orphan C' }],
      },
    ]);
  });
});
