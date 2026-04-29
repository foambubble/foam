/* @unit-ready */
import * as vscode from 'vscode';
import { createTestNote, createTestWorkspace } from '../../../test/test-utils';
import {
  cleanWorkspace,
  getUriInWorkspace,
} from '../../../test/test-utils-vscode';
import { MapBasedMemento } from '../../utils/vsc-utils';
import { FoamWorkspace } from '@foam/core';
import { FoamGraph } from '@foam/core';
import { Resource } from '@foam/core';
import { NotesProvider } from './notes-explorer';
import { ResourceTreeItem } from '../../utils/tree-views/tree-view-utils';
import { FolderTreeItem } from '../../utils/tree-views/folder-tree-provider';

let ws: FoamWorkspace;
let graph: FoamGraph;
let noteA: Resource;
let noteB: Resource;
let noteC: Resource;
let image: Resource;

beforeAll(async () => {
  await cleanWorkspace();
  // All notes are created under the mock workspace folder so that
  // asRelativePath() can strip the workspace prefix correctly.
  const rootUri = getUriInWorkspace('just-a-ref.md');
  ws = createTestWorkspace();

  noteA = createTestNote({
    root: rootUri,
    uri: './note-a.md',
    title: 'Alpha',
  });
  noteB = createTestNote({
    root: rootUri,
    uri: './note-b.md',
    title: 'Beta',
    links: [{ slug: 'note-a' }],
  });
  // noteC lives inside a sub-folder
  noteC = createTestNote({
    root: rootUri,
    uri: './sub/note-c.md',
    title: 'Gamma',
  });
  image = createTestNote({
    root: rootUri,
    uri: './image.png',
    type: 'image',
  });

  ws.set(noteA).set(noteB).set(noteC).set(image);
  graph = FoamGraph.fromWorkspace(ws, true);
});

afterAll(async () => {
  graph.dispose();
  ws.dispose();
  await cleanWorkspace();
});

describe('Notes Explorer - flat view', () => {
  it('shows only notes (excludes images and attachments)', async () => {
    const provider = new NotesProvider(ws, graph, new MapBasedMemento());
    await provider.viewMode.update('flat');
    await provider.show.update('notes-only');
    provider.refresh();

    const items = (await provider.getChildren()) as ResourceTreeItem[];
    expect(items.every(i => i.resource.type === 'note')).toBe(true);
    expect(
      items.find(i => i.resource.uri.path === image.uri.path)
    ).toBeUndefined();
  });

  it('shows all resource types when show is set to "all"', async () => {
    const provider = new NotesProvider(ws, graph, new MapBasedMemento());
    await provider.viewMode.update('flat');
    await provider.show.update('all');
    provider.refresh();

    const items = (await provider.getChildren()) as ResourceTreeItem[];
    expect(
      items.find(i => i.resource.uri.path === image.uri.path)
    ).toBeDefined();
  });

  it('shows items sorted alphabetically by title', async () => {
    const provider = new NotesProvider(ws, graph, new MapBasedMemento());
    await provider.viewMode.update('flat');
    await provider.show.update('notes-only');
    provider.refresh();

    const items = (await provider.getChildren()) as ResourceTreeItem[];
    const labels = items.map(i => i.label.toString());
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
  });

  it('shows the folder path as description for notes in sub-folders', async () => {
    const provider = new NotesProvider(ws, graph, new MapBasedMemento());
    await provider.viewMode.update('flat');
    await provider.show.update('notes-only');
    provider.refresh();

    const items = (await provider.getChildren()) as ResourceTreeItem[];
    const noteCItem = items.find(i => i.resource.uri.path === noteC.uri.path);
    expect(noteCItem?.description?.toString()).toContain('sub');
  });

  it('root-level notes have no folder path prefix in description', async () => {
    const provider = new NotesProvider(ws, graph, new MapBasedMemento());
    await provider.viewMode.update('flat');
    await provider.show.update('notes-only');
    provider.refresh();

    const items = (await provider.getChildren()) as ResourceTreeItem[];
    const noteAItem = items.find(i => i.resource.uri.path === noteA.uri.path);
    // description should not contain a folder path segment
    expect(noteAItem?.description?.toString() ?? '').not.toContain('sub');
  });
});

describe('Notes Explorer - hierarchy view', () => {
  it('returns folders and root-level notes at top level', async () => {
    const provider = new NotesProvider(ws, graph, new MapBasedMemento());
    await provider.viewMode.update('hierarchy');
    provider.refresh();

    const items = await provider.getChildren();
    const folders = items.filter(i => i instanceof FolderTreeItem);
    const notes = items.filter(i => i instanceof ResourceTreeItem);
    expect(folders.length).toBeGreaterThan(0);
    expect(notes.length).toBeGreaterThan(0);
  });

  it('shows folders before files', async () => {
    const provider = new NotesProvider(ws, graph, new MapBasedMemento());
    await provider.viewMode.update('hierarchy');
    provider.refresh();

    const items = await provider.getChildren();
    const firstNoteIndex = items.findIndex(i => i instanceof ResourceTreeItem);
    const lastFolderIndex = items.reduce(
      (last, item, idx) => (item instanceof FolderTreeItem ? idx : last),
      -1
    );
    expect(firstNoteIndex).toBeGreaterThan(lastFolderIndex);
  });

  it('shows notes nested inside their folder', async () => {
    const provider = new NotesProvider(ws, graph, new MapBasedMemento());
    await provider.viewMode.update('hierarchy');
    provider.refresh();

    const items = await provider.getChildren();
    const folder = items.find(
      i => i instanceof FolderTreeItem
    ) as FolderTreeItem<any>;
    const children = (await provider.getChildren(
      folder as any
    )) as ResourceTreeItem[];
    expect(children.length).toBeGreaterThan(0);
    expect(children[0].resource.uri.path).toBe(noteC.uri.path);
  });
});

describe('Notes Explorer - text filtering', () => {
  it('filters notes by title (case-insensitive)', async () => {
    const provider = new NotesProvider(ws, graph, new MapBasedMemento());
    provider.setFilter('ALPHA');
    provider.refresh();

    const items = (await provider.getChildren()) as ResourceTreeItem[];
    expect(items.length).toBe(1);
    expect(items[0].resource.uri.path).toBe(noteA.uri.path);
  });

  it('filters notes by path segment', async () => {
    const provider = new NotesProvider(ws, graph, new MapBasedMemento());
    await provider.viewMode.update('flat');
    await provider.show.update('notes-only');
    provider.setFilter('sub');
    provider.refresh();

    const items = (await provider.getChildren()) as ResourceTreeItem[];
    expect(items.length).toBe(1);
    expect(items[0].resource.uri.path).toBe(noteC.uri.path);
  });

  it('returns no items when filter matches nothing', async () => {
    const provider = new NotesProvider(ws, graph, new MapBasedMemento());
    provider.setFilter('zzznomatch');
    provider.refresh();

    const items = await provider.getChildren();
    expect(items.length).toBe(0);
  });

  it('prunes folders with no matching notes in hierarchy view', async () => {
    const provider = new NotesProvider(ws, graph, new MapBasedMemento());
    await provider.viewMode.update('hierarchy');
    // filter matches only root-level notes, not the one inside "sub/"
    provider.setFilter('alpha');
    provider.refresh();

    const items = await provider.getChildren();
    const folders = items.filter(i => i instanceof FolderTreeItem);
    expect(folders.length).toBe(0);
  });

  it('keeps folders that contain matching notes in hierarchy view', async () => {
    const provider = new NotesProvider(ws, graph, new MapBasedMemento());
    await provider.viewMode.update('hierarchy');
    // filter matches noteC which is inside "sub/"
    provider.setFilter('sub');
    provider.refresh();

    const items = await provider.getChildren();
    const folders = items.filter(i => i instanceof FolderTreeItem);
    expect(folders.length).toBe(1);
  });

  it('expands folders automatically when a filter is active', async () => {
    const provider = new NotesProvider(ws, graph, new MapBasedMemento());
    await provider.viewMode.update('hierarchy');
    provider.setFilter('gamma');
    provider.refresh();

    const items = await provider.getChildren();
    const folder = items.find(
      i => i instanceof FolderTreeItem
    ) as FolderTreeItem<any>;
    expect(folder?.collapsibleState).toBe(
      vscode.TreeItemCollapsibleState.Expanded
    );
  });

  it('collapses folders when no filter is active', async () => {
    const provider = new NotesProvider(ws, graph, new MapBasedMemento());
    await provider.viewMode.update('hierarchy');
    provider.refresh();

    const items = await provider.getChildren();
    const folder = items.find(
      i => i instanceof FolderTreeItem
    ) as FolderTreeItem<any>;
    expect(folder?.collapsibleState).toBe(
      vscode.TreeItemCollapsibleState.Collapsed
    );
  });
});

describe('Notes Explorer - connections', () => {
  it('hides backlink children and shows count badge when connections are hidden', async () => {
    const provider = new NotesProvider(ws, graph, new MapBasedMemento());
    await provider.viewMode.update('flat');
    await provider.show.update('notes-only');
    await provider.showConnections.update('hide');
    provider.refresh();

    const items = (await provider.getChildren()) as ResourceTreeItem[];
    // noteA has 1 backlink (from noteB)
    const noteAItem = items.find(i => i.resource.uri.path === noteA.uri.path);
    expect(noteAItem?.collapsibleState).toBe(
      vscode.TreeItemCollapsibleState.None
    );
    expect(noteAItem?.description?.toString()).toContain('↓1');
  });

  it('shows outgoing link count in badge when connections are hidden', async () => {
    const provider = new NotesProvider(ws, graph, new MapBasedMemento());
    await provider.viewMode.update('flat');
    await provider.show.update('notes-only');
    await provider.showConnections.update('hide');
    provider.refresh();

    const items = (await provider.getChildren()) as ResourceTreeItem[];
    // noteB links to noteA
    const noteBItem = items.find(i => i.resource.uri.path === noteB.uri.path);
    expect(noteBItem?.description?.toString()).toContain('↑1');
  });

  it('makes items with backlinks collapsible when connections are shown', async () => {
    const provider = new NotesProvider(ws, graph, new MapBasedMemento());
    await provider.viewMode.update('flat');
    await provider.show.update('notes-only');
    await provider.showConnections.update('show');
    provider.refresh();

    const items = (await provider.getChildren()) as ResourceTreeItem[];
    const noteAItem = items.find(i => i.resource.uri.path === noteA.uri.path);
    expect(noteAItem?.collapsibleState).toBe(
      vscode.TreeItemCollapsibleState.Collapsed
    );
    const noteCItem = items.find(i => i.resource.uri.path === noteC.uri.path);
    expect(noteCItem?.collapsibleState).toBe(
      vscode.TreeItemCollapsibleState.None
    );
  });

  it('shows no connection badge for notes with no links or backlinks', async () => {
    const provider = new NotesProvider(ws, graph, new MapBasedMemento());
    await provider.viewMode.update('flat');
    await provider.show.update('notes-only');
    await provider.showConnections.update('hide');
    provider.refresh();

    const items = (await provider.getChildren()) as ResourceTreeItem[];
    // noteC has no links or backlinks
    const noteCItem = items.find(i => i.resource.uri.path === noteC.uri.path);
    const desc = noteCItem?.description?.toString() ?? '';
    expect(desc).not.toContain('↑');
    expect(desc).not.toContain('↓');
  });
});
