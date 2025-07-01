import { workspace, window } from 'vscode';
import {
  createTestNote,
  createTestWorkspace,
  TEST_DATA_DIR,
} from '../../test/test-utils';
import {
  cleanWorkspace,
  closeEditors,
  createNote,
  getUriInWorkspace,
} from '../../test/test-utils-vscode';
import { ConnectionsTreeDataProvider } from './connections';
import { MapBasedMemento, toVsCodeUri } from '../../utils/vsc-utils';
import { FoamGraph } from '../../core/model/graph';
import {
  ResourceRangeTreeItem,
  ResourceTreeItem,
} from './utils/tree-view-utils';
import { FoamWorkspace } from '../../core/model/workspace';
import { Resource } from '../../core/model/note';
import { createMarkdownParser } from '../../core/services/markdown-parser';

describe('Backlinks panel', () => {
  beforeAll(async () => {
    await cleanWorkspace();
    await createNote(noteA);
    await createNote(noteB);
    await createNote(noteC);
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

  const provider = new ConnectionsTreeDataProvider(
    ws,
    graph,
    new MapBasedMemento(),
    false
  );

  afterAll(async () => {
    graph.dispose();
    ws.dispose();
    provider.dispose();
    await cleanWorkspace();
  });

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
      arguments: [expect.objectContaining({ path: noteB.uri.path })],
    });
    const links = (await provider.getChildren(notes[0])) as ResourceTreeItem[];
    expect(links[0].command).toMatchObject({
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

describe('Backlinks panel with block identifiers', () => {
  let ws: FoamWorkspace;
  let graph: FoamGraph;
  let provider: ConnectionsTreeDataProvider;
  let noteWithBlockId: Resource;
  let noteLinkingToBlockId: Resource;

  beforeAll(async () => {
    await cleanWorkspace();

    const noteWithBlockIdUri = TEST_DATA_DIR.joinPath(
      'block-identifiers',
      'note-with-block-id.md'
    );
    const noteLinkingToBlockIdUri = TEST_DATA_DIR.joinPath(
      'block-identifiers',
      'note-linking-to-block-id.md'
    );

    const noteWithBlockIdContent = Buffer.from(
      await workspace.fs.readFile(toVsCodeUri(noteWithBlockIdUri))
    ).toString('utf8');
    const noteLinkingToBlockIdContent = Buffer.from(
      await workspace.fs.readFile(toVsCodeUri(noteLinkingToBlockIdUri))
    ).toString('utf8');

    const parser = createMarkdownParser();
    const rootUri = getUriInWorkspace('just-a-ref.md').getDirectory();

    noteWithBlockId = parser.parse(
      rootUri.joinPath('note-with-block-id.md'),
      noteWithBlockIdContent
    );
    noteLinkingToBlockId = parser.parse(
      rootUri.joinPath('note-linking-to-block-id.md'),
      noteLinkingToBlockIdContent
    );

    await createNote(noteWithBlockId);
    await createNote(noteLinkingToBlockId);

    ws = createTestWorkspace();
    ws.set(noteWithBlockId);
    ws.set(noteLinkingToBlockId);
    graph = FoamGraph.fromWorkspace(ws, true);
    provider = new ConnectionsTreeDataProvider(
      ws,
      graph,
      new MapBasedMemento(),
      false
    );
  });

  afterAll(async () => {
    if (graph) graph.dispose();
    if (ws) ws.dispose();
    if (provider) provider.dispose();
    await cleanWorkspace();
  });

  beforeEach(async () => {
    await closeEditors();
    provider.target = undefined;
  });

  it('shows backlinks to blocks', async () => {
    provider.target = noteWithBlockId.uri;
    await provider.refresh();
    const notes = (await provider.getChildren()) as ResourceTreeItem[];
    expect(notes.map(n => n.resource.uri.path)).toEqual([
      noteLinkingToBlockId.uri.path,
    ]);
    const links = (await provider.getChildren(
      notes[0]
    )) as ResourceRangeTreeItem[];
    expect(links[0].label).toEqual(
      'This is a paragraph with a block identifier. ^block-1'
    );
  });
});
