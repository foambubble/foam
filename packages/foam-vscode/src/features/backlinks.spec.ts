import { workspace, window } from 'vscode';
import { URI, FoamWorkspace, IDataStore } from 'foam-core';
import {
  cleanWorkspace,
  closeEditors,
  createNote,
  createTestNote,
} from '../test/test-utils';
import { BacklinksTreeDataProvider, BacklinkTreeItem } from './backlinks';
import { ResourceTreeItem } from '../utils/grouped-resources-tree-data-provider';
import { OPEN_COMMAND } from './utility-commands';

describe('Backlinks panel', () => {
  beforeAll(async () => {
    await cleanWorkspace();
    await createNote(noteA);
    await createNote(noteB);
    await createNote(noteC);
  });
  afterAll(async () => {
    ws.dispose();
    await cleanWorkspace();
  });

  const rootUri = workspace.workspaceFolders[0].uri;
  const ws = new FoamWorkspace();
  const dataStore = {
    read: uri => {
      return Promise.resolve('');
    },
    isMatch: uri => uri.path.endsWith('.md'),
  } as IDataStore;

  const noteA = createTestNote({
    root: rootUri,
    uri: './note-a.md',
  });
  const noteB = createTestNote({
    root: rootUri,
    uri: './note-b.md',
    links: [{ slug: 'note-a' }, { slug: 'note-a' }],
  });
  const noteC = createTestNote({
    root: rootUri,
    uri: './note-c.md',
    links: [{ slug: 'note-a' }],
  });
  ws.set(noteA)
    .set(noteB)
    .set(noteC)
    .resolveLinks(true);

  const provider = new BacklinksTreeDataProvider(ws, dataStore);

  beforeEach(async () => {
    await closeEditors();
    provider.target = undefined;
  });

  // Skipping these as still figuring out how to interact with the provider
  // running in the test instance of VS Code
  it.skip('does not target excluded files', async () => {
    provider.target = URI.file('/excluded-file.txt');
    expect(await provider.getChildren()).toEqual([]);
  });
  it.skip('targets active editor', async () => {
    const docA = await workspace.openTextDocument(noteA.uri);
    const docB = await workspace.openTextDocument(noteB.uri);

    await window.showTextDocument(docA);
    expect(provider.target).toEqual(noteA.uri);

    await window.showTextDocument(docB);
    expect(provider.target).toEqual(noteB.uri);
  });

  it('shows linking resources alphaetically by name', async () => {
    provider.target = noteA.uri;
    const notes = (await provider.getChildren()) as ResourceTreeItem[];
    expect(notes.map(n => n.resource.uri.path)).toEqual([
      noteB.uri.path,
      noteC.uri.path,
    ]);
  });
  it('shows references in range order', async () => {
    provider.target = noteA.uri;
    const notes = (await provider.getChildren()) as ResourceTreeItem[];
    const linksFromB = (await provider.getChildren(
      notes[0]
    )) as BacklinkTreeItem[];
    expect(linksFromB.map(l => l.link)).toEqual(
      noteB.links.sort(
        (a, b) => a.range.start.character - b.range.start.character
      )
    );
  });
  it('navigates to the document if clicking on note', async () => {
    provider.target = noteA.uri;
    const notes = (await provider.getChildren()) as ResourceTreeItem[];
    expect(notes[0].command).toMatchObject({
      command: OPEN_COMMAND.command,
      arguments: [expect.objectContaining({ resource: noteB.uri })],
    });
  });
  it('navigates to document with link selection if clicking on backlink', async () => {
    provider.target = noteA.uri;
    const notes = (await provider.getChildren()) as ResourceTreeItem[];
    const linksFromB = (await provider.getChildren(
      notes[0]
    )) as BacklinkTreeItem[];
    expect(linksFromB[0].command).toMatchObject({
      command: 'vscode.open',
      arguments: [
        noteB.uri,
        {
          selection: expect.arrayContaining([]),
        },
      ],
    });
  });
  it('refreshes upon changes in the workspace', async () => {
    let notes: ResourceTreeItem[] = [];
    provider.target = noteA.uri;

    notes = (await provider.getChildren()) as ResourceTreeItem[];
    expect(notes.length).toEqual(2);

    const noteD = createTestNote({
      root: rootUri,
      uri: './note-d.md',
    });
    ws.set(noteD);
    notes = (await provider.getChildren()) as ResourceTreeItem[];
    expect(notes.length).toEqual(2);

    const noteDBis = createTestNote({
      root: rootUri,
      uri: './note-d.md',
      links: [{ slug: 'note-a' }],
    });
    ws.set(noteDBis);
    notes = (await provider.getChildren()) as ResourceTreeItem[];
    expect(notes.length).toEqual(3);
    expect(notes.map(n => n.resource.uri.path)).toEqual(
      [noteB.uri, noteC.uri, noteD.uri].map(uri => uri.path)
    );
  });
});
