import { OrphansProvider, Directory, OrphansProviderConfig } from './orphans';
import { OrphansConfigGroupBy } from '../settings';
import { FoamWorkspace } from 'foam-core';
import { createTestNote } from '../test/test-utils';

describe('orphans', () => {
  const orphanA = createTestNote({
    uri: '/path/orphan-a.md',
    title: 'Orphan A',
  });
  const orphanB = createTestNote({
    uri: '/path-bis/orphan-b.md',
    title: 'Orphan B',
  });
  const orphanC = createTestNote({
    uri: '/path-exclude/orphan-c.md',
    title: 'Orphan C',
  });

  const workspace = new FoamWorkspace()
    .set(orphanA)
    .set(orphanB)
    .set(orphanC)
    .set(createTestNote({ uri: '/path/non-orphan-1.md' }))
    .set(
      createTestNote({
        uri: '/path/non-orphan-2.md',
        links: [{ slug: 'non-orphan-1' }],
      })
    )
    .resolveLinks();

  const dataStore = { read: () => '' } as any;

  // Mock config
  const config: OrphansProviderConfig = {
    exclude: ['path-exclude/**/*'],
    groupBy: OrphansConfigGroupBy.Folder,
    workspacesFsPaths: [''],
  };

  it('should return the orphans as a folder tree', async () => {
    const provider = new OrphansProvider(workspace, dataStore, config);
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
    const provider = new OrphansProvider(workspace, dataStore, config);
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
    const provider = new OrphansProvider(workspace, dataStore, mockConfig);
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
    const provider = new OrphansProvider(workspace, dataStore, mockConfig);
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
