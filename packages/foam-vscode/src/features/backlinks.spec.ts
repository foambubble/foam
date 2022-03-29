import { workspace, window } from 'vscode';
import { createTestNote, createTestWorkspace } from '../test/test-utils';
import {
  cleanWorkspace,
  closeEditors,
  createNote,
  getUriInWorkspace,
} from '../test/test-utils-vscode';
import { BacklinksTreeDataProvider, BacklinkTreeItem } from './backlinks';
import { ResourceTreeItem } from '../utils/grouped-resources-tree-data-provider';
import { OPEN_COMMAND } from './utility-commands';
import { toVsCodeUri } from '../utils/vsc-utils';
import { FoamGraph } from '../core/model/graph';
import { URI } from '../core/model/uri';

describe('Backlinks panel', () => {
  beforeAll(async () => {
    await cleanWorkspace();
    await createNote(noteA);
    await createNote(noteB);
    await createNote(noteC);
  });
  afterAll(async () => {
    graph.dispose();
    ws.dispose();
    await cleanWorkspace();
  });

  // TODO: this should really just be the workspace folder, use that once #806 is fixed
  const rootUri = getUriInWorkspace('just-a-ref.md');
  const ws = createTestWorkspace();

  const noteA = createTestNote({
    root: rootUri,
    uri: './note-a.md',
  });
  const noteB = createTestNote({
    root: rootUri,
    uri: './note-b.md',
    links: [{ slug: 'note-a' }, { slug: 'note-a#section' }],
  });
  const noteC = createTestNote({
    root: rootUri,
    uri: './note-c.md',
    links: [{ slug: 'note-a' }],
  });
  ws.set(noteA)
    .set(noteB)
    .set(noteC);
  const graph = FoamGraph.fromWorkspace(ws, true);

  const provider = new BacklinksTreeDataProvider(ws, graph);

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
    const docA = await workspace.openTextDocument(toVsCodeUri(noteA.uri));
    const docB = await workspace.openTextDocument(toVsCodeUri(noteB.uri));

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
      arguments: [expect.objectContaining({ uri: noteB.uri })],
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
