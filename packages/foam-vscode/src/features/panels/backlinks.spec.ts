import { workspace, window } from 'vscode';
import { createTestNote, createTestWorkspace } from '../../test/test-utils';
import {
  cleanWorkspace,
  closeEditors,
  createNote,
  getUriInWorkspace,
} from '../../test/test-utils-vscode';
import { BacklinksTreeDataProvider } from './backlinks';
import { toVsCodeUri } from '../../utils/vsc-utils';
import { FoamGraph } from '../../core/model/graph';
import {
  ResourceRangeTreeItem,
  ResourceTreeItem,
} from './utils/tree-view-utils';

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
  ws.set(noteA).set(noteB).set(noteC);
  const graph = FoamGraph.fromWorkspace(ws, true);

  const provider = new BacklinksTreeDataProvider(ws, graph);

  beforeEach(async () => {
    await closeEditors();
    provider.target = undefined;
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
    await provider.refresh();
    const notes = (await provider.getChildren()) as ResourceTreeItem[];
    expect(notes.map(n => n.resource.uri.path)).toEqual([
      noteB.uri.path,
      noteC.uri.path,
    ]);
  });
  it('shows references in range order', async () => {
    provider.target = noteA.uri;
    await provider.refresh();
    const notes = (await provider.getChildren()) as ResourceTreeItem[];
    const linksFromB = (await provider.getChildren(
      notes[0]
    )) as ResourceRangeTreeItem[];
    expect(linksFromB.map(l => l.range)).toEqual(
      noteB.links
        .map(l => l.range)
        .sort((a, b) => a.start.character - b.start.character)
    );
  });
  it('navigates to the document if clicking on note', async () => {
    provider.target = noteA.uri;
    await provider.refresh();
    const notes = (await provider.getChildren()) as ResourceTreeItem[];
    expect(notes[0].command).toMatchObject({
      command: 'vscode.open',
      arguments: [
        expect.objectContaining({ path: noteB.uri.path }),
        expect.objectContaining({ selection: expect.anything() }),
      ],
    });
  });
  it('navigates to document with link selection if clicking on backlink', async () => {
    provider.target = noteA.uri;
    await provider.refresh();
    const notes = (await provider.getChildren()) as ResourceTreeItem[];
    const linksFromB = (await provider.getChildren(
      notes[0]
    )) as ResourceRangeTreeItem[];
    expect(linksFromB[0].command).toMatchObject({
      command: 'vscode.open',
      arguments: [
        expect.objectContaining({ path: noteB.uri.path }),
        {
          selection: expect.arrayContaining([]),
        },
      ],
    });
  });
  it('refreshes upon changes in the workspace', async () => {
    let notes: ResourceTreeItem[] = [];
    provider.target = noteA.uri;
    await provider.refresh();
    notes = (await provider.getChildren()) as ResourceTreeItem[];
    expect(notes.length).toEqual(2);

    const noteD = createTestNote({
      root: rootUri,
      uri: './note-d.md',
    });
    ws.set(noteD);
    await provider.refresh();
    notes = (await provider.getChildren()) as ResourceTreeItem[];
    expect(notes.length).toEqual(2);

    const noteDBis = createTestNote({
      root: rootUri,
      uri: './note-d.md',
      links: [{ slug: 'note-a' }],
    });
    ws.set(noteDBis);
    await provider.refresh();
    notes = (await provider.getChildren()) as ResourceTreeItem[];
    expect(notes.map(n => n.resource.uri.path)).toEqual(
      [noteB.uri, noteC.uri, noteD.uri].map(uri => uri.path)
    );
  });
});
